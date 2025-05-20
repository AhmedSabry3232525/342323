// توليد deviceId وتخزينه محلياً إذا لم يوجد
        function getDeviceId() {
            let deviceId = localStorage.getItem('deviceId');
            if (!deviceId) {
                deviceId = 'dev-' + Math.random().toString(36).substr(2, 16) + '-' + Date.now();
                localStorage.setItem('deviceId', deviceId);
            }
            return deviceId;
        }

        auth.onAuthStateChanged(async (user) => {
            document.getElementById("loading-screen").style.display = "block"; // Show loading screen
            const deviceId = getDeviceId();
            if (user) {
                const userDocRef = db.collection("pendingUsers").doc(user.uid);
                const userDoc = await userDocRef.get();
                if (userDoc.exists) {
                    // تحقق من الموافقة لهذا الجهاز فقط
                    const pendingDevices = userDoc.data().pendingDevices || {};
                    const approved = pendingDevices[deviceId] === true;
                    if (approved) {
                        const userData = JSON.parse(localStorage.getItem('userData')) || {};
                        userData.approved = true; // Update local storage with current approval status
                        localStorage.setItem('userData', JSON.stringify(userData));

                        document.getElementById("registration-page").style.display = "none";
                        document.getElementById("waiting-page").style.display = "none";
                        document.getElementById("main-content").style.display = "block";
                        document.getElementById("username-display").innerHTML = `<span>مرحباً،</span> ${userDoc.data().name}`;

                        const profilePicture = userData.profilePicture || "https://cdn-icons-png.flaticon.com/512/2641/2641333.png";
                        document.getElementById("welcome-image").src = profilePicture;

                        await fetchPlaylists();
                    } else {
                        localStorage.setItem('userData', JSON.stringify({
                            ...userDoc.data(),
                            approved: false
                        }));
                        document.getElementById("registration-page").style.display = "none";
                        document.getElementById("main-content").style.display = "none";
                        document.getElementById("waiting-page").style.display = "block";
                        // تعبئة معلومات الحساب في صفحة الانتظار
                        document.getElementById("waiting-name").textContent = userDoc.data().name || "--";
                        document.getElementById("waiting-email").textContent = userDoc.data().email || "--";
                        document.getElementById("waiting-phone").textContent = userDoc.data().phone || "--";
                    }
                } else {
                    // User document doesn't exist (account was deleted)
                    localStorage.removeItem('userData'); // Clear stored data
                    await auth.signOut(); // Sign out the user
                    document.getElementById("registration-page").style.display = "block";
                    document.getElementById("main-content").style.display = "none";
                    document.getElementById("waiting-page").style.display = "none";
                }
            } else {
                // No user is signed in
                const savedData = localStorage.getItem('userData');
                if (savedData) {
                    // Verify if the saved data is still valid
                    const userData = JSON.parse(savedData);
                    const userDoc = await db.collection("pendingUsers").doc(userData.uid).get();
                    
                    if (!userDoc.exists) {
                        // User document no longer exists
                        localStorage.removeItem('userData');
                        document.getElementById("registration-page").style.display = "block";
                        document.getElementById("main-content").style.display = "none";
                        document.getElementById("waiting-page").style.display = "none";
                    } else {
                        document.getElementById("registration-page").style.display = "none";
                        document.getElementById("main-content").style.display = "none";
                        document.getElementById("waiting-page").style.display = "block";
                        // تعبئة معلومات الحساب من localStorage
                        document.getElementById("waiting-name").textContent = userData.name || "--";
                        document.getElementById("waiting-email").textContent = userData.email || "--";
                        document.getElementById("waiting-phone").textContent = userData.phone || "--";
                    }
                } else {
                    document.getElementById("registration-page").style.display = "block";
                    document.getElementById("main-content").style.display = "none";
                    document.getElementById("waiting-page").style.display = "none";
                }
            }
            document.getElementById("loading-screen").style.display = "none"; // Hide loading screen
        });

        async function registerUser() {
            const registerButton = document.getElementById("register-button");
            registerButton.textContent = "جارى التسجيل... لا تضغط مرة أخرى، انتظر قليلاً";
            registerButton.disabled = true;

            const name = document.getElementById("signup-name").value.trim();
            const email = document.getElementById("signup-email").value;
            const password = document.getElementById("signup-password").value;
            const passwordConfirm = document.getElementById("signup-password-confirm").value;
            const phone = document.getElementById("signup-phone").value;

            // تاريخ الميلاد
            const dobDay = document.getElementById("dob-day").value;
            const dobMonth = document.getElementById("dob-month").value;
            const dobYear = document.getElementById("dob-year").value;

            // التحقق من إدخال تاريخ الميلاد بشكل احترافي
            if (!dobDay || !dobMonth || !dobYear) {
                alert("يرجى اختيار يوم وشهر وسنة الميلاد. هذا الخيار مهم جداً لاسترجاع الحساب إذا نسيت كلمة المرور.");
                registerButton.textContent = "تسجيل";
                registerButton.disabled = false;
                return;
            }
            // تحقق من صحة التاريخ (بسيط)
            const dobDate = new Date(`${dobYear}-${dobMonth}-${dobDay}`);
            if (isNaN(dobDate.getTime())) {
                alert("تاريخ الميلاد غير صحيح.");
                registerButton.textContent = "تسجيل";
                registerButton.disabled = false;
                return;
            }

            const arabicRegex = /^[\u0600-\u06FF\s]+$/; // Arabic characters and spaces only
            const phoneRegex = /^01[0-2,5]{1}[0-9]{8}$/; // Valid Egyptian phone number format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Basic email validation

            // التحقق من الاسم الثنائي
            const nameParts = name.split(' ').filter(part => part.length > 0);
            if (nameParts.length < 2) {
                alert("يرجى إدخال الاسم الثنائي (الاسم الأول والأخير)");
                registerButton.textContent = "تسجيل";
                registerButton.disabled = false;
                return;
            }

            if (!arabicRegex.test(name)) {
                alert("يرجى إدخال الاسم باللغة العربية فقط بدون أرقام أو علامات");
                registerButton.textContent = "تسجيل";
                registerButton.disabled = false;
                return;
            }

            // تحقق من صحة البريد الإلكتروني
            if (!emailRegex.test(email)) {
                alert("يرجى إدخال بريد إلكتروني صالح.");
                registerButton.textContent = "تسجيل";
                registerButton.disabled = false;
                return;
            }

            if (!phone) {
                alert("يرجى إدخال رقم الهاتف.");
                registerButton.textContent = "تسجيل";
                registerButton.disabled = false;
                return;
            }

            if (!phoneRegex.test(phone)) {
                alert("يرجى إدخال رقم هاتف صالح");
                registerButton.textContent = "تسجيل";
                registerButton.disabled = false;
                return;
            }

            if (password !== passwordConfirm) {
                alert("كلمتا المرور غير متطابقتين. يرجى التأكد.");
                registerButton.textContent = "تسجيل";
                registerButton.disabled = false;
                return;
            }

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                const userData = {
                    uid: user.uid,
                    name: name,
                    email: email,
                    phone: phone,
                    password: password,
                    approved: false,
                    dob: { day: dobDay, month: dobMonth, year: dobYear }
                };

                localStorage.setItem('userData', JSON.stringify(userData));
                localStorage.setItem('backupUserData', JSON.stringify(userData)); // Save a backup

                // إضافة pendingDevices لهذا الجهاز فقط عند التسجيل
                const deviceId = getDeviceId();

                await db.collection("pendingUsers").doc(user.uid).set({
                    name: name,
                    email: email,
                    phone: phone,
                    approved: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    data: {
                        password: password // Save the password under "المهم" inside a nested object
                    },
                    dob: { day: dobDay, month: dobMonth, year: dobYear }, // حفظ تاريخ الميلاد
                    playlists: Object.fromEntries(
                        unlistedPlaylistIds.map((id, index) => [String(index + 1), false])
                    ),
                    pendingDevices: {
                        [deviceId]: false
                    }
                });

                document.getElementById("registration-page").style.display = "none";
                document.getElementById("waiting-page").style.display = "block";
            } catch (error) {
                alert("خطأ: " + error.message);
                registerButton.textContent = "تسجيل";
                registerButton.disabled = false;
            }
        }

        async function loginUser() {
            const loginButton = document.getElementById("login-button");
            loginButton.textContent = "جارى تسجيل الدخول...";
            loginButton.disabled = true;

            // استخدم login-identifier بدلاً من login-email
            const identifier = document.getElementById("login-identifier").value.trim();
            const password = document.getElementById("login-password").value;

            if (!identifier || !password) {
                alert("يرجى إدخال البريد الإلكتروني أو رقم الهاتف وكلمة المرور.");
                loginButton.textContent = "دخول";
                loginButton.disabled = false;
                return;
            }

            // تحقق إذا كان بريد إلكتروني أو رقم هاتف
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const phoneRegex = /^01[0-2,5]{1}[0-9]{8}$/;

            let emailToLogin = identifier;

            if (!emailRegex.test(identifier)) {
                // إذا لم يكن بريدًا، تحقق إذا كان رقم هاتف
                if (phoneRegex.test(identifier)) {
                    // ابحث عن المستخدم بهذا الرقم في قاعدة البيانات
                    try {
                        const usersSnap = await db.collection("pendingUsers").where("phone", "==", identifier).get();
                        if (usersSnap.empty) {
                            alert("لا يوجد حساب مرتبط بهذا الرقم.");
                            loginButton.textContent = "دخول";
                            loginButton.disabled = false;
                            return;
                        }
                        // استخدم أول مستخدم مطابق (يفترض رقم الهاتف فريد)
                        const userDoc = usersSnap.docs[0];
                        emailToLogin = userDoc.data().email;
                    } catch (err) {
                        alert("حدث خطأ أثناء البحث عن الحساب.");
                        loginButton.textContent = "دخول";
                        loginButton.disabled = false;
                        return;
                    }
                } else {
                    alert("يرجى إدخال بريد إلكتروني صحيح أو رقم هاتف مصري صحيح.");
                    loginButton.textContent = "دخول";
                    loginButton.disabled = false;
                    return;
                }
            }

            try {
                const userCredential = await auth.signInWithEmailAndPassword(emailToLogin, password);
                const user = userCredential.user;
                const userDocRef = db.collection("pendingUsers").doc(user.uid);
                const userDoc = await userDocRef.get();

                if (!userDoc.exists) {
                    alert("الحساب غير موجود.");
                    await auth.signOut();
                    loginButton.textContent = "دخول";
                    loginButton.disabled = false;
                    return;
                }

                const data = userDoc.data();

                // تحديث pendingDevices لهذا الجهاز فقط
                const deviceId = getDeviceId();
                let pendingDevices = { ...((data && data.pendingDevices) || {}) };
                Object.keys(pendingDevices).forEach(key => {
                    if (pendingDevices[key] === false && key !== deviceId) {
                        delete pendingDevices[key];
                    }
                });
                pendingDevices[deviceId] = false;
                await userDocRef.update({ pendingDevices });

                // حفظ بيانات المستخدم محلياً
                const userData = {
                    uid: user.uid,
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    password: password,
                    approved: false // دائماً false بعد تسجيل الدخول
                };
                localStorage.setItem('userData', JSON.stringify(userData));
                localStorage.setItem('backupUserData', JSON.stringify(userData));

                // إظهار صفحة الانتظار حتى تتم الموافقة من الأدمن
                document.getElementById("registration-page").style.display = "none";
                document.getElementById("main-content").style.display = "none";
                document.getElementById("waiting-page").style.display = "block";
                loginButton.textContent = "دخول";
                loginButton.disabled = false;
                return;
            } catch (error) {
                alert("خطأ أثناء تسجيل الدخول: " + error.message);
            }
            loginButton.textContent = "دخول";
            loginButton.disabled = false;
        }

        function restoreLastAccount() {
            let savedData = localStorage.getItem('userData');
            if (!savedData) {
                savedData = localStorage.getItem('backupUserData'); // Fallback to backup
            }

            if (savedData) {
                const userData = JSON.parse(savedData);
                auth.signInWithEmailAndPassword(userData.email, userData.password)
                    .then(() => {
                        // Automatically redirect to the main content without showing an alert
                        document.getElementById("registration-page").style.display = "none";
                        document.getElementById("waiting-page").style.display = "none";
                        document.getElementById("main-content").style.display = "block";
                    })
                    .catch((error) => {
                        alert("خطأ أثناء تسجيل الدخول: " + error.message);
                    });
            } else {
                alert("لا توجد بيانات حساب محفوظة على هذا الجهاز.");
            }
        }

        async function forgotPassword() {
            const btn = document.getElementById('forgot-password-button');
            btn.textContent = "جارى البحث ...";
            btn.disabled = true;
            document.getElementById('forgot-password-result').textContent = '';

            const identifier = document.getElementById('forgot-identifier').value.trim();
            const dobDay = document.getElementById('forgot-dob-day').value;
            const dobMonth = document.getElementById('forgot-dob-month').value;
            const dobYear = document.getElementById('forgot-dob-year').value;

            if (!identifier) {
                alert("يرجى إدخال البريد الإلكتروني أو رقم الهاتف.");
                btn.textContent = "استرجاع كلمة المرور";
                btn.disabled = false;
                return;
            }
            if (!dobDay || !dobMonth || !dobYear) {
                alert("يرجى اختيار يوم وشهر وسنة الميلاد.");
                btn.textContent = "استرجاع كلمة المرور";
                btn.disabled = false;
                return;
            }

            // تحقق من صحة التاريخ (بسيط)
            const dobDate = new Date(`${dobYear}-${dobMonth}-${dobDay}`);
            if (isNaN(dobDate.getTime())) {
                alert("تاريخ الميلاد غير صحيح.");
                btn.textContent = "استرجاع كلمة المرور";
                btn.disabled = false;
                return;
            }

            // بحث عن المستخدم
            let userSnap = null;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const phoneRegex = /^01[0-2,5]{1}[0-9]{8}$/;
            try {
                if (emailRegex.test(identifier)) {
                    userSnap = await db.collection("pendingUsers").where("email", "==", identifier).get();
                } else if (phoneRegex.test(identifier)) {
                    userSnap = await db.collection("pendingUsers").where("phone", "==", identifier).get();
                } else {
                    alert("يرجى إدخال بريد إلكتروني صحيح أو رقم هاتف مصري صحيح.");
                    btn.textContent = "استرجاع كلمة المرور";
                    btn.disabled = false;
                    return;
                }
                if (userSnap.empty) {
                    document.getElementById('forgot-password-result').textContent = "لم يتم العثور على حساب بهذه البيانات.";
                    btn.textContent = "استرجاع كلمة المرور";
                    btn.disabled = false;
                    return;
                }
                // تحقق من تاريخ الميلاد
                let found = false;
                let password = "";
                userSnap.forEach(doc => {
                    const data = doc.data();
                    if (
                        data.dob &&
                        String(data.dob.day) === String(dobDay) &&
                        String(data.dob.month) === String(dobMonth) &&
                        String(data.dob.year) === String(dobYear)
                    ) {
                        found = true;
                        password = data.data && data.data.password ? data.data.password : "";
                    }
                });
                if (found && password) {
                    document.getElementById('forgot-password-result').innerHTML = `<span style="color:#388e3c;">كلمة المرور الخاصة بك: <span style="direction:ltr;unicode-bidi:plaintext;background:#e0f2f1;padding:4px 8px;border-radius:5px;">${password}</span></span>`;
                } else {
                    document.getElementById('forgot-password-result').textContent = "بيانات تاريخ الميلاد غير صحيحة أو الحساب غير مكتمل البيانات.";
                }
            } catch (err) {
                document.getElementById('forgot-password-result').textContent = "حدث خطأ أثناء البحث. حاول مرة أخرى.";
            }
            btn.textContent = "استرجاع كلمة المرور";
            btn.disabled = false;
        }
