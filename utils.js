// IndexedDB utility for file caching
        const dbName = "videoFilesDB";
        const storeName = "files";
        function openDB() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(dbName, 1);
                req.onupgradeneeded = function(e) {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, { keyPath: "url" });
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }
        function getFileFromDB(url) {
            return openDB().then(db => new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);
                const req = store.get(url);
                req.onsuccess = () => resolve(req.result ? req.result.blob : null);
                req.onerror = () => reject(req.error);
            }));
        }
        function saveFileToDB(url, blob) {
            return openDB().then(db => new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                store.put({ url, blob });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            }));
        }

        // Circular progress bar generator
        function getCircularProgress(percent) {
            // percent: 0-100
            const r = 18, c = 2 * Math.PI * r;
            const val = Math.round(percent);
            return `
            <svg width="44" height="44" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="${r}" fill="none" stroke="#e3f2fd" stroke-width="5"/>
                <circle cx="22" cy="22" r="${r}" fill="none" stroke="#1a73e8" stroke-width="5"
                    stroke-dasharray="${c}" stroke-dashoffset="${c - (c * percent / 100)}" stroke-linecap="round"/>
                <text x="22" y="25" text-anchor="middle" font-size="13" fill="#1a73e8" font-weight="bold">${val}%</text>
            </svg>
            `;
        }

        // Download and cache file with progress, ثم افتحه من التخزين الداخلى فقط
        async function downloadAndOpenFile(url, btn) {
            btn.disabled = true;
            btn.setAttribute("data-downloading", "1");
            btn.innerHTML = getCircularProgress(0);

            try {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error("Network error");
                const contentLength = resp.headers.get("Content-Length");
                const total = contentLength ? parseInt(contentLength) : 0;
                const reader = resp.body.getReader();
                let received = 0, chunks = [];
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    received += value.length;
                    let percent = total ? Math.round(received * 100 / total) : 0;
                    btn.innerHTML = getCircularProgress(percent);
                }
                const blob = new Blob(chunks);
                await saveFileToDB(url, blob);
                btn.disabled = false;
                btn.removeAttribute("data-downloading");
                btn.innerHTML = btn.getAttribute("data-label");
                openBlobFile(blob, url);
            } catch (e) {
                btn.disabled = false;
                btn.removeAttribute("data-downloading");
                btn.innerHTML = "فشل التحميل، حاول مرة أخرى";
                setTimeout(() => { btn.innerHTML = btn.getAttribute("data-label"); }, 2000);
            }
        }

        // --- إضافة دوال فك التشفير AES-CTR بنفس طريقة التشفير المرسلة ---
        async function aesDecrypt(data, keyStr) {
            const enc = new TextEncoder();
            const iv = data.slice(0, 16);
            const encryptedData = data.slice(16);
            const keyMaterial = await window.crypto.subtle.importKey(
                "raw",
                enc.encode(keyStr.padEnd(32).slice(0, 32)),
                "AES-CTR",
                false,
                ["decrypt"]
            );
            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-CTR", counter: iv, length: 64 },
                keyMaterial,
                encryptedData
            );
            return new Uint8Array(decrypted);
        }

        // دالة لفك تشفير ملف Blob مشفر (امتداد .enc أو octet-stream)
        async function decryptBlobIfNeeded(blob, url) {
            // إذا كان الملف PDF عادي (وليس مشفر) أعده كما هو
            if (
                (blob.type && blob.type.toLowerCase().includes("pdf")) ||
                (typeof url === "string" && url.toLowerCase().endsWith(".pdf"))
            ) {
                return blob;
            }
            // إذا كان الامتداد .enc أو النوع application/octet-stream أو النوع فارغ
            if (
                (typeof url === "string" && url.toLowerCase().endsWith(".enc")) ||
                (blob.type === "application/octet-stream" || blob.type === "")
            ) {
                // المفتاح الثابت
                const key = "#G7p@zL2";
                // اقرأ البيانات
                const arrayBuffer = await blob.arrayBuffer();
                const data = new Uint8Array(arrayBuffer);
                // فك التشفير
                const decryptedAll = await aesDecrypt(data, key);
                // إزالة الـ salt (16 بايت)
                const saltLength = 16;
                const decryptedData = decryptedAll.slice(saltLength);
                // حاول تحديد نوع الملف الأصلي (PDF أو صورة أو غيره)
                let detectedType = "";
                // PDF header: 0x25 0x50 0x44 0x46 ("%PDF")
                if (
                    decryptedData[0] === 0x25 &&
                    decryptedData[1] === 0x50 &&
                    decryptedData[2] === 0x44 &&
                    decryptedData[3] === 0x46
                ) {
                    detectedType = "application/pdf";
                }
                // صورة JPG: 0xFF 0xD8 0xFF
                else if (
                    decryptedData[0] === 0xFF &&
                    decryptedData[1] === 0xD8 &&
                    decryptedData[2] === 0xFF
                ) {
                    detectedType = "image/jpeg";
                }
                // PNG: 0x89 0x50 0x4E 0x47
                else if (
                    decryptedData[0] === 0x89 &&
                    decryptedData[1] === 0x50 &&
                    decryptedData[2] === 0x4E &&
                    decryptedData[3] === 0x47
                ) {
                    detectedType = "image/png";
                }
                // ...يمكن إضافة أنواع أخرى حسب الحاجة...
                else {
                    detectedType = "application/octet-stream";
                }
                return new Blob([decryptedData], { type: detectedType });
            }
            // إذا لم يكن مشفر، أعده كما هو
            return blob;
        }

        // --- تعديل openBlobFile: فك التشفير إذا لزم الأمر ---
        async function openBlobFile(blob, url) {
            // فك التشفير إذا كان الملف مشفر
            const realBlob = await decryptBlobIfNeeded(blob, url);

            // تحديد نوع الملف من Blob أو URL
            const fileType = realBlob.type ||
                (url && url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '') ||
                (url && url.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/) ? 'image' : '');
            const fileURL = URL.createObjectURL(realBlob);

            if (fileType.includes('pdf') || (url && url.toLowerCase().endsWith('.pdf'))) {
                openPdfViewer(realBlob, true, url); // تمرير url هنا
            } else if (fileType.includes('image')) {
                window.open(fileURL, "_blank");
            } else {
                const a = document.createElement('a');
                a.href = fileURL;
                a.target = '_blank';
                a.click();
            }
        }

        // --- تعديل openPdfViewer: دعم فك التشفير إذا كان blob مشفر ---
        async function openPdfViewer(blob, inline = false, url = "") {
            // فك التشفير إذا لزم الأمر
            const realBlob = await decryptBlobIfNeeded(blob, url);

            if (!inline) {
                // ...existing code for modal viewer...
                document.getElementById('pdf-viewer-modal').style.display = 'block';
                const pagesContainer = document.getElementById('pages-container');
                pagesContainer.innerHTML = '<div style="color:#fff;font-size:1.2em;margin:30px;">جارٍ تحميل الملف...</div>';
                const fileURL = URL.createObjectURL(realBlob);
                try {
                    const pdf = await pdfjsLib.getDocument(fileURL).promise;
                    pagesContainer.innerHTML = '';
                    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                        const page = await pdf.getPage(pageNum);
                        const viewport = page.getViewport({ scale: 1.2 });
                        const canvas = document.createElement('canvas');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        const context = canvas.getContext('2d');
                        await page.render({ canvasContext: context, viewport: viewport }).promise;
                        pagesContainer.appendChild(canvas);
                    }
                } catch (e) {
                    pagesContainer.innerHTML = '<div style="color:#fff;font-size:1.2em;margin:30px;">تعذر عرض الملف. ربما الملف تالف أو ليس PDF صالح.</div>';
                }
                return;
            }

            // --- عرض مدمج: إخفاء كل شيء وإظهار محتوى PDF فقط ---
            Array.from(document.body.children).forEach(el => {
                if (el.id !== 'inline-pdf-viewer') {
                    el.setAttribute('data-prev-display', el.style.display);
                    el.style.display = 'none';
                }
            });
            const viewer = document.getElementById('inline-pdf-viewer');
            viewer.style.display = 'block';
            viewer.innerHTML = `
                <button onclick="closeInlinePdfViewer()" style="position:fixed;top:12px;left:12px;z-index:100000;background:#dc3545;color:#fff;border:none;border-radius:6px;padding:10px 18px;font-size:1.1em;box-shadow:0 2px 8px #0002;cursor:pointer;">إغلاق</button>
                <div id="inline-pdf-pages" style="max-width:900px;margin:60px auto 30px auto;display:flex;flex-direction:column;gap:24px;"></div>
            `;
            const pagesDiv = viewer.querySelector('#inline-pdf-pages');
            pagesDiv.innerHTML = '<div style="color:#1a73e8;font-size:1.2em;margin:30px;">جارٍ تحميل الملف...</div>';

            const fileURL = URL.createObjectURL(realBlob);
            try {
                const pdf = await pdfjsLib.getDocument(fileURL).promise;
                pagesDiv.innerHTML = '';
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 1.2 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const context = canvas.getContext('2d');
                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    canvas.style.boxShadow = "0 2px 16px #0002";
                    canvas.style.background = "#fff";
                    canvas.style.borderRadius = "8px";
                    pagesDiv.appendChild(canvas);
                }
            } catch (e) {
                pagesDiv.innerHTML = '<div style="color:#d32f2f;font-size:1.2em;margin:30px;">تعذر عرض الملف. ربما الملف تالف أو ليس PDF صالح.</div>';
            }
        }

        // دالة إغلاق العرض المدمج للـPDF
        function closeInlinePdfViewer() {
            // أخفِ الـviewer وأعد إظهار كل عناصر الصفحة كما كانت
            document.getElementById('inline-pdf-viewer').style.display = 'none';
            Array.from(document.body.children).forEach(el => {
                if (el.id !== 'inline-pdf-viewer') {
                    // استرجع قيمة display الأصلية فقط
                    const prev = el.getAttribute('data-prev-display');
                    el.style.display = (prev !== null) ? prev : '';
                    el.removeAttribute('data-prev-display');
                }
            });
            document.getElementById('inline-pdf-viewer').innerHTML = '';
        }

        // دالة إغلاق نافذة الـ PDF
        function closePdfViewer() {
            document.getElementById('pdf-viewer-modal').style.display = 'none';
            document.getElementById('pages-container').innerHTML = '';
        }
