let player; // Global variable to hold the Plyr instance

        function openVideoPlayer(videoId) {
            const iframe = document.getElementById("video-player-iframe");
            iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;

            const username = document.getElementById("username-display").textContent.replace("مرحباً،", "").trim();
            const userData = JSON.parse(localStorage.getItem('userData')) || {};
            const phone = userData.phone || "غير متوفر";

            const watermark = document.getElementById("watermark");
            watermark.innerHTML = `
                <div style="text-align: center; line-height: 1;">
                    <div>${username}</div>
                    <div>${phone}</div>
                </div>`;
            watermark.style.opacity = "0.3"; // More transparent for videos
            watermark.style.display = "block"; // Show watermark

            document.getElementById("video-player-modal").style.display = "flex";

            if (!player) {
                player = new Plyr('.plyr__video-embed', {
                    controls: [
                        'play-large',
                        'play',
                        'progress',
                        'current-time',
                        'duration',
                        'settings',
                        'fullscreen'
                    ],
                    seekTime: 10,
                    keyboard: {
                        focused: true,
                        global: true
                    },
                    listeners: {
                        rewind: (event) => {
                            showSeekOverlay('⪡ -10s', 'rewind');
                        },
                        fastForward: (event) => {
                            showSeekOverlay('⪢ +10s', 'forward');
                        }
                    }
                });

                // إضافة دالة إظهار الحركة المرئية
                function showSeekOverlay(text, type) {
                    const overlayClass = type === 'rewind' ? 'plyr__rewind-overlay' : 'plyr__forward-overlay';
                    const container = player.elements.container;
                    
                    // إزالة أي overlay سابق
                    const existingOverlay = container.querySelector(`.${overlayClass}`);
                    if (existingOverlay) {
                        existingOverlay.remove();
                    }

                    // إنشاء overlay جديد
                    const overlay = document.createElement('div');
                    overlay.className = overlayClass;
                    overlay.textContent = text;
                    container.appendChild(overlay);

                    // تفعيل الحركة
                    requestAnimationFrame(() => {
                        overlay.style.opacity = '1';
                        setTimeout(() => {
                            overlay.style.opacity = '0';
                            setTimeout(() => overlay.remove(), 200);
                        }, 500);
                    });
                }

                // إضافة استماع لأزرار لوحة المفاتيح
                document.addEventListener('keydown', (e) => {
                    if (document.activeElement.tagName === 'INPUT') return;
                    
                    if (e.key === 'ArrowLeft') {
                        showSeekOverlay('⪡ -10s', 'rewind');
                    } else if (e.key === 'ArrowRight') {
                        showSeekOverlay('⪢ +10s', 'forward');
                    }
                });

                // منع الإيقاف المؤقت إلا من زر المشغل فقط
                setTimeout(() => {
                    const plyrEmbed = document.querySelector('.plyr__video-embed');
                    if (plyrEmbed) {
                        // منع الإيقاف المؤقت عند النقر على الفيديو
                        plyrEmbed.onclick = function(e) {
                            // السماح فقط إذا كان الضغط على زر التحكم نفسه
                            if (
                                e.target.classList.contains('plyr__control') &&
                                (e.target.getAttribute('data-plyr') === 'play' || e.target.getAttribute('data-plyr') === 'pause')
                            ) {
                                // السماح بالافتراضي
                            } else {
                                // منع الإيقاف المؤقت
                                e.stopPropagation();
                                e.preventDefault();
                            }
                        };
                    }
                    // منع الإيقاف المؤقت من خلال مفتاح المسافة أو Enter
                    document.addEventListener('keydown', function(e) {
                        // إذا كان الفيديو ظاهر
                        if (document.getElementById("video-player-modal").style.display === "flex") {
                            if (
                                (e.code === "Space" || e.key === " " || e.keyCode === 32 || e.key === "Enter" || e.keyCode === 13)
                                && document.activeElement.tagName !== "BUTTON"
                                && document.activeElement.tagName !== "INPUT"
                            ) {
                                // السماح فقط إذا كان التركيز على زر play/pause
                                const active = document.activeElement;
                                if (
                                    !(active && active.classList.contains('plyr__control') &&
                                    (active.getAttribute('data-plyr') === 'play' || active.getAttribute('data-plyr') === 'pause'))
                                ) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }
                            }
                        }
                    }, true);
                }, 500);

            } else {
                player.play();
            }

            player.on('playing', () => {
                document.getElementById("exit-video-button").style.display = "block";
            });

            // Add tooltips after player initialization
            if (!localStorage.getItem('tooltipsShown')) {
                // Helper to wait for a selector to appear
                function waitForElement(selector, timeout = 4000) {
                    return new Promise((resolve, reject) => {
                        const interval = 50;
                        let elapsed = 0;
                        function check() {
                            const el = document.querySelector(selector);
                            if (el) return resolve(el);
                            elapsed += interval;
                            if (elapsed >= timeout) return reject();
                            setTimeout(check, interval);
                        }
                        check();
                    });
                }
                // Wait for both buttons to appear
                Promise.all([
                    waitForElement('[data-plyr="fast-forward"]'),
                    waitForElement('[data-plyr="rewind"]')
                ]).then(() => {
                    const tooltips = [
                        {
                            text: 'اضغط مرتين للتقديم 10 ثواني للأمام',
                            selector: '[data-plyr="fast-forward"]',
                            icon: '⏩'
                        },
                        {
                            text: 'اضغط مرتين للرجوع 10 ثواني للخلف',
                            selector: '[data-plyr="rewind"]',
                            icon: '⏪'
                        }
                    ];
                    let currentTooltipIndex = 0;
                    function showNextTooltip() {
                        if (currentTooltipIndex < tooltips.length) {
                            const tip = tooltips[currentTooltipIndex];
                            const button = document.querySelector(tip.selector);
                            if (button) {
                                const tooltip = document.createElement('div');
                                tooltip.className = 'video-tooltip';
                                tooltip.innerHTML = `
                                    <div class="tooltip-content">
                                        <span class="tooltip-icon">${tip.icon}</span>
                                        <span>${tip.text}</span>
                                    </div>
                                    <button class="tooltip-button">فهمت</button>
                                `;
                                document.body.appendChild(tooltip);
                                // Position tooltip above the button, مع ضمان عدم خروجه من الشاشة
                                const rect = button.getBoundingClientRect();
                                // حساب الموضع المبدئي
                                let left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
                                let top = rect.top - tooltip.offsetHeight - 12;
                                // ضمان عدم الخروج من اليمين أو اليسار
                                if (left < 8) left = 8;
                                if (left + tooltip.offsetWidth > window.innerWidth - 8) {
                                    left = window.innerWidth - tooltip.offsetWidth - 8;
                                }
                                // ضمان عدم الخروج من الأعلى (خاصة في الشاشات الصغيرة)
                                if (top < 8) top = rect.bottom + 12;
                                tooltip.style.left = left + 'px';
                                tooltip.style.top = top + 'px';
                                setTimeout(() => tooltip.classList.add('show'), 100);
                                tooltip.querySelector('.tooltip-button').addEventListener('click', () => {
                                    tooltip.classList.remove('show');
                                    setTimeout(() => {
                                        tooltip.remove();
                                        currentTooltipIndex++;
                                        showNextTooltip();
                                    }, 300);
                                });
                            } else {
                                // If button not found, skip to next
                                currentTooltipIndex++;
                                showNextTooltip();
                            }
                        } else {
                            localStorage.setItem('tooltipsShown', 'true');
                        }
                    }
                    showNextTooltip();
                });
            }

            const plyrEmbed = document.querySelector('.plyr__video-embed');
            if (plyrEmbed) {
                // أضف overlay إذا لم يكن موجوداً
                let dblOverlay = plyrEmbed.querySelector('.plyr__dblseek-overlay');
                if (!dblOverlay) {
                    dblOverlay = document.createElement('div');
                    dblOverlay.className = '.plyr__dblseek-overlay';
                    dblOverlay.style.cssText = `
                        position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                        background:rgba(0,0,0,0.7);color:#fff;font-size:2.2em;
                        border-radius:50%;width:90px;height:90px;display:flex;
                        align-items:center;justify-content:center;z-index:10;opacity:0;
                        pointer-events:none;transition:opacity 0.2s;
                    `;
                    plyrEmbed.style.position = 'relative';
                    plyrEmbed.appendChild(dblOverlay);
                }

                plyrEmbed.ondblclick = function(e) {
                    const rect = plyrEmbed.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    let text = '';
                    if (x < rect.width / 2) {
                        // الجهة اليسرى: ترجيع 10 ثواني
                        if (player) player.rewind(10);
                        text = '⪡ 10s-';
                    } else {
                        // الجهة اليمنى: تقديم 10 ثواني
                        if (player) player.forward(10);
                        text = '10s+ ⪢';
                    }
                    // إظهار الإشارة
                    dblOverlay.textContent = text;
                    dblOverlay.style.opacity = '1';
                    setTimeout(() => { dblOverlay.style.opacity = '0'; }, 600);

                    e.preventDefault();
                    e.stopPropagation();
                };
            }

            // إضافة overlay خاص بالتسريع
            let speedOverlay = document.getElementById('plyr-speed-overlay');
            if (!speedOverlay) {
                speedOverlay = document.createElement('div');
                speedOverlay.id = 'plyr-speed-overlay';
                speedOverlay.style.cssText = `
                    position:absolute;top:18px;left:50%;transform:translateX(-50%);
                    background:rgba(26,115,232,0.28);color:#fff;font-size:1.25em;
                    border-radius:12px;padding:4px 18px;z-index:20;opacity:0;
                    pointer-events:none;transition:opacity 0.18s;
                    font-weight:bold;box-shadow:0 1px 6px #1a73e833;
                    user-select:none;
                `;
                const plyrEmbed = document.querySelector('.plyr__video-embed');
                if (plyrEmbed) {
                    plyrEmbed.appendChild(speedOverlay);
                }
            }

            // متغيرات للتحكم في الضغط المطول
            let speedTimeout = null;
            let isSpeeding = false;

            // دوال تفعيل/إلغاء التسريع
            function enableSpeed() {
                if (player && !isSpeeding) {
                    player.speed = 2;
                    isSpeeding = true;
                    speedOverlay.textContent = '2x';
                    speedOverlay.style.opacity = '1';
                }
            }
            function disableSpeed() {
                if (player && isSpeeding) {
                    player.speed = 1;
                    isSpeeding = false;
                    speedOverlay.style.opacity = '0';
                }
                if (speedTimeout) {
                    clearTimeout(speedTimeout);
                    speedTimeout = null;
                }
            }

            // إضافة أحداث الضغط المطول على منطقة الفيديو
            setTimeout(() => {
                const plyrEmbed = document.querySelector('.plyr__video-embed');
                if (plyrEmbed) {
                    // دعم الماوس
                    plyrEmbed.onmousedown = function(e) {
                        if (e.button !== 0) return; // فقط الزر الأيسر
                        speedTimeout = setTimeout(enableSpeed, 350);
                    };
                    plyrEmbed.onmouseup = function() { disableSpeed(); };
                    plyrEmbed.onmouseleave = function() { disableSpeed(); };
                    // دعم اللمس
                    plyrEmbed.ontouchstart = function(e) {
                        speedTimeout = setTimeout(enableSpeed, 350);
                    };
                    plyrEmbed.ontouchend = function() { disableSpeed(); };
                    plyrEmbed.ontouchcancel = function() { disableSpeed(); };
                }
            }, 400); // بعد تهيئة المشغل

        }

        function closeVideoPlayer(event) {
            if (player) {
                player.destroy(); // Destroy the Plyr instance
                player = null;
            }
            const iframe = document.getElementById("video-player-iframe");
            iframe.src = ""; // Clear the iframe source
            document.getElementById("video-player-modal").style.display = "none";
            document.getElementById("videos").style.display = "grid"; // Show videos grid

            // Hide the "خروج" button when the video player is closed
            document.getElementById("exit-video-button").style.display = "none";

            // Remove the watermark
            const watermark = document.getElementById("watermark");
            if (watermark) {
                watermark.textContent = "";
                watermark.style.display = "none";
            }

            // Prevent page reset
            event.preventDefault();
        }

        // Remove the event listener for the "X" button since it's hidden
        // document.getElementById("close-video-player").addEventListener("click", closeVideoPlayer);

        // Add fallback for Android browsers
        document.getElementById("exit-video-button").addEventListener("click", () => {
            closeVideoPlayer();
            setTimeout(() => {
                document.body.scrollTop = 0; // For Safari
                document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE, and Opera
            }, 100); // Ensure smooth reset
        });

        document.getElementById("close-video-player").addEventListener("click", closeVideoPlayer);
        document.getElementById("exit-video-button").addEventListener("click", closeVideoPlayer);

        document.getElementById("load-more-button").addEventListener("click", () => {
            const playlistId = document.querySelector(".course-container").getAttribute("onclick").match(/'([^']+)'/)[1];
            fetchVideos(playlistId, true);
        });

        document.getElementById("back-button").addEventListener("click", () => {
            document.getElementById("playlists").style.display = "grid";
            document.getElementById("videos").style.display = "none";
            document.getElementById("back-button").style.display = "none";
            document.getElementById("load-more-button").style.display = "none";
        });

        let lastScrollTop = 0;
        const navbar = document.querySelector('.navbar');

        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            if (scrollTop > lastScrollTop) {
                navbar.classList.add('hidden'); // Hide navbar on scroll down
            } else {
                navbar.classList.remove('hidden'); // Show navbar on scroll up
            }
            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // Prevent negative scroll values
        });

        function hideInstruction() {
            const instruction = document.getElementById("course-instruction");
            if (instruction) {
                instruction.style.display = "none";
            }
        }

        function showInstruction() {
            const instruction = document.getElementById("course-instruction");
            if (instruction) {
                instruction.style.display = "block";
            }
        }

        document.getElementById("playlists").addEventListener("click", hideInstruction);
        document.getElementById("back-button").addEventListener("click", showInstruction);

        async function checkForUpdates() {
            try {
                const updateDoc = await db.collection("appSettings1").doc("updateStatus").get();
                if (updateDoc.exists) {
                    const updateRequired = updateDoc.data().updateRequired;
                    console.log("Update Required:", updateRequired); // تحقق من القيمة
                    if (updateRequired) {
                        showUpdateAlert(); // عرض رسالة التحديث
                    }
                } else {
                    console.log("Document does not exist."); // إذا لم يتم العثور على المستند
                }
            } catch (error) {
                console.error("خطأ أثناء التحقق من التحديث:", error);
            }
        }

        function showUpdateAlert() {
            // إنشاء عنصر الرسالة
            const alertOverlay = document.createElement("div");
            alertOverlay.style.position = "fixed";
            alertOverlay.style.top = "0";
            alertOverlay.style.left = "0";
            alertOverlay.style.width = "100%";
            alertOverlay.style.height = "100%";
            alertOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
            alertOverlay.style.zIndex = "9999";
            alertOverlay.style.display = "flex";
            alertOverlay.style.flexDirection = "column";
            alertOverlay.style.justifyContent = "center";
            alertOverlay.style.alignItems = "center";
            alertOverlay.style.color = "white";
            alertOverlay.style.textAlign = "center";
            alertOverlay.style.animation = "fadeIn 1s ease-in-out";

            // محتوى الرسالة
            alertOverlay.innerHTML = `
                <div style="text-align: center; display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 120px; height: 120px; border: 10px solid red; border-radius: 50%; display: flex; justify-content: center; align-items: center; animation: pulse 1.5s infinite;">
                        <span style="font-size: 3rem; font-weight: bold; color: red;">!</span>
                    </div>
                    <h1 style="font-size: 2.5rem; font-weight: bold; margin-top: 20px; animation: bounce 1.5s infinite;">
                        ⚠️ تحديث مطلوب ⚠️
                    </h1>
                    <p style="font-size: 1.5rem; margin-top: 10px;">
                        تم إصدار تحديث جديد للتطبيق. يرجى إزالة النسخة الحالية وتثبيت النسخة الجديدة.
                    </p>
                </div>
            `;

            // منع المستخدم من تخطي الرسالة
            document.body.innerHTML = "";
            document.body.appendChild(alertOverlay);
        }

        // إضافة الرسوم المتحركة
        const style = document.createElement("style");
        style.innerHTML = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            @keyframes pulse {
                 0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);

        // استدعاء الدالة عند بدء التطبيق
        checkForUpdates();

        function ensureWatermarkInFullscreen() {
            const watermark = document.getElementById('watermark');
            if (document.fullscreenElement) {
                // Append watermark to the fullscreen element
                document.fullscreenElement.appendChild(watermark);
                watermark.style.position = 'absolute'; // Adjust position for fullscreen
            } else {
                // Return watermark to its original position
                document.body.appendChild(watermark);
                watermark.style.position = 'fixed'; // Reset position
            }
        }

        document.addEventListener('fullscreenchange', ensureWatermarkInFullscreen);
        document.addEventListener('webkitfullscreenchange', ensureWatermarkInFullscreen); // For Safari
        document.addEventListener('mozfullscreenchange', ensureWatermarkInFullscreen); // For Firefox
        document.addEventListener('MSFullscreenChange', ensureWatermarkInFullscreen); // For IE/Edge

        // إظهار land page فقط وإخفاء كل شيء آخر
        document.getElementById("show-playlists-btn").addEventListener("click", function() {
            document.getElementById("main-navbar").style.display = "none";
            document.getElementById("main-welcome").style.display = "none";
            document.getElementById("playlists").style.display = "none";
            document.getElementById("videos").style.display = "none";
            document.getElementById("back-button").style.display = "none";
            document.getElementById("load-more-button").style.display = "none";
            document.getElementById("back-to-landing-btn").style.display = "none";
            document.getElementById("playlists-landpage").style.display = "block";
            showPlaylistsLand();
        });

        // عند الرجوع من land page أظهر كل شيء كما كان
        document.getElementById("back-to-main-btn").addEventListener("click", function() {
            document.getElementById("main-navbar").style.display = "flex";
            document.getElementById("main-navbar").style.alignItems = "center";
            document.getElementById("main-navbar").style.justifyContent = "center";
            document.querySelector('.logo-container').style.display = "flex";
            document.getElementById("main-welcome").style.display = "block";
            document.getElementById("playlists-landpage").style.display = "none";
            // Reset land page state
            document.getElementById("playlists-land").innerHTML = "";
            document.getElementById("videos-land").innerHTML = "";
            document.getElementById("videos-land").style.display = "none";
            document.getElementById("back-button-land").style.display = "none";
            document.getElementById("load-more-button-land").style.display = "none";
        });

        // منطق عرض قوائم التشغيل والفيديوهات في land page فقط
        let nextPageTokenLand = null;
        let currentPlaylistIdLand = null;
