async function fetchPlaylists() {
            try {
                const user = auth.currentUser;
                if (!user) return;

                const userDoc = await db.collection("pendingUsers").doc(user.uid).get();
                if (!userDoc.exists) return;

                const userPlaylists = userDoc.data().playlists || {};
                const visiblePlaylists = Object.keys(userPlaylists)
                    .filter(key => userPlaylists[key] === true)
                    .map(key => unlistedPlaylistIds[parseInt(key, 10) - 1]);

                if (visiblePlaylists.length === 0) {
                    document.getElementById("playlists").innerHTML = `
                        <div class="error-message">
                            لست مشترك فى اى كورسات او كورساتك التى انت مشترك فيها لم ترفع فديوهات حتى لان
                        </div>`;
                    return;
                }

                const API_KEY = "AIzaSyBMHmHT75657eKEa0fTxJAVS5vhnls7f44";
                const playlistIds = visiblePlaylists.join(',');
                const response = await fetch(`https://www.googleapis.com/youtube/v3/playlists?key=${API_KEY}&id=${playlistIds}&part=snippet,contentDetails&maxResults=${visiblePlaylists.length}`);
                const data = await response.json();

                if (data.items && data.items.length > 0) {
                    renderPlaylists(data.items);
                }
            } catch (error) {
                document.getElementById("playlists").innerHTML = `
                    <div class="error-message">
                        عذراً، حدث خطأ أثناء تحميل قوائم التشغيل.
                    </div>`;
            }
        }

        function renderPlaylists(playlists) {
            let html = "";
            // تعديل: دالة مساعدة لحساب الإحصائيات لكل قائمة تشغيل
            async function getPlaylistStats(playlistId) {
                const API_KEY = "AIzaSyBMHmHT75657eKEa0fTxJAVS5vhnls7f44";
                let allItems = [];
                let pageToken = "";
                do {
                    let url = `https://www.googleapis.com/youtube/v3/playlistItems?key=${API_KEY}&playlistId=${playlistId}&part=snippet&maxResults=50`;
                    if (pageToken) url += `&pageToken=${pageToken}`;
                    const response = await fetch(url);
                    const data = await response.json();
                    allItems = allItems.concat(data.items);
                    pageToken = data.nextPageToken || "";
                } while (pageToken);

                // اجمع كل videoId
                const videoIdsArr = allItems.map(item => item.snippet.resourceId.videoId);
                // قسمها دفعات (لأن API يحد 50)
                let detailsMap = {};
                for (let i = 0; i < videoIdsArr.length; i += 50) {
                    const ids = videoIdsArr.slice(i, i + 50).join(',');
                    const videosDetailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${ids}&part=snippet,contentDetails,statistics`);
                    const videosDetailsData = await videosDetailsRes.json();
                    videosDetailsData.items.forEach(item => detailsMap[item.id] = item);
                }

                // بناء شجرة المجلدات
                const tree = {};
                allItems.forEach(item => {
                    const videoId = item.snippet.resourceId.videoId;
                    const details = detailsMap[videoId];
                    if (!details) return;
                    const desc = details.snippet.description || "";
                    const firstLine = desc.split('\n')[0].trim();
                    let pathArr = [];
                    if (firstLine.startsWith('/') && !/^https?:\/\//i.test(firstLine)) {
                        pathArr = firstLine.split('/').filter(Boolean);
                    }
                    let node = tree;
                    if (pathArr.length > 0) {
                        for (let i = 0; i < pathArr.length; i++) {
                            const part = pathArr[i];
                            if (!node[part]) node[part] = {};
                            node = node[part];
                        }
                    }
                    if (!node._videos) node._videos = [];
                    node._videos.push({ item, details });
                });

                // حساب الإحصائيات
                function getStats(node) {
                    let videoCount = 0, fileCount = 0, totalSeconds = 0, folderCount = 0;
                    if (!node) return { videoCount, fileCount, totalSeconds, folderCount };
                    if (node._videos && node._videos.length > 0) {
                        node._videos.forEach(({ details }) => {
                            if (details && details.contentDetails && details.contentDetails.duration) {
                                videoCount++;
                                // تحويل ISO إلى ثواني
                                const match = details.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                                if (match) {
                                    const [, h, m, s] = match.map(x => parseInt(x || '0', 10));
                                    totalSeconds += h * 3600 + m * 60 + s;
                                }
                            }
                            // حساب الملفات المنفصلة
                            let description = details.snippet.description || '';
                            let descLines = description.split('\n');
                            for (let i = 0; i < descLines.length; i++) {
                                let line = descLines[i].trim();
                                const urlMatch = line.match(/^(https?:\/\/[^\s]+)$/i);
                                if (urlMatch && i + 1 < descLines.length) {
                                    const nextLine = descLines[i + 1].trim();
                                    const fileMatch = nextLine.match(/^(\d+)?\s*\(([^)]+)\)$/);
                                    if (fileMatch) {
                                        fileCount++;
                                        i++;
                                        continue;
                                    }
                                }
                                const inlineMatch = line.match(/^(https?:\/\/[^\s]+)\s*(\d+)?\s*\(([^)]+)\)$/i);
                                if (inlineMatch) {
                                    fileCount++;
                                    continue;
                                }
                            }
                        });
                    }
                    Object.keys(node).forEach(key => {
                        if (key !== "_videos" && key !== "playlistId") {
                            folderCount++;
                            const stats = getStats(node[key]);
                            videoCount += stats.videoCount;
                            fileCount += stats.fileCount;
                            totalSeconds += stats.totalSeconds;
                            folderCount += stats.folderCount;
                        }
                    });
                    return { videoCount, fileCount, totalSeconds, folderCount };
                }
                // دالة لتحويل ثواني إلى نص وقت hh:mm:ss أو mm:ss
                function formatSecondsToTime(secs) {
                    const h = Math.floor(secs / 3600);
                    const m = Math.floor((secs % 3600) / 60);
                    const s = secs % 60;
                    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                    return `${m}:${String(s).padStart(2, '0')}`;
                }

                const stats = getStats(tree);
                return {
                    videoCount: stats.videoCount,
                    fileCount: stats.fileCount,
                    folderCount: stats.folderCount,
                    duration: formatSecondsToTime(stats.totalSeconds)
                };
            }

            // تعديل: استخدم Promise.all لجلب الإحصائيات لكل قائمة تشغيل
            const statsPromises = playlists.map(pl => getPlaylistStats(pl.id));
            Promise.all(statsPromises).then(statsArr => {
                playlists.forEach((playlist, idx) => {
                    const playlistId = playlist.id;
                    const title = playlist.snippet.title;
                    // --- تحليل وصف قائمة التشغيل لاستخراج روابط الصور ---
                    let description = playlist.snippet.description || '';
                    let descLines = description.split('\n').map(l => l.trim()).filter(Boolean);
                    let customThumb = '';
                    let customCircle = '';
                    // إذا كان أول سطر رابط صورة
                    if (descLines[0] && /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)$/i.test(descLines[0])) {
                        customThumb = descLines[0];
                    }
                    // إذا كان ثاني سطر أيضاً رابط صورة
                    if (descLines[1] && /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)$/i.test(descLines[1])) {
                        customCircle = descLines[1];
                    }
                    // الصورة المصغرة الافتراضية
                    const thumbnail = customThumb || playlist.snippet.thumbnails?.medium?.url || playlist.snippet.thumbnails?.default?.url || '';
                    const itemCount = playlist.contentDetails?.itemCount || '-';
                    const stats = statsArr[idx];
                    html += `
                        <div class="course-container video-container video-responsive" 
                             onclick="fetchVideos('${playlistId}')"
                             style="flex-direction: column; padding: 0;">
                            <div class="video-thumb-wrap playlist-thumb" style="width: 100%; max-width: 100%; margin-bottom: 10px; position:relative;">
                                <img src="${thumbnail}" alt="صورة مصغرة" class="video-thumb" style="width: 100%; height: 180px; object-fit:cover;">
                                ${customCircle ? `<img src="${customCircle}" alt="صورة دائرية" style="position:absolute;bottom:12px;left:12px;width:60px;height:60px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px #0003;object-fit:cover;background:#fff;">` : ''}
                                <span class="video-duration">${itemCount} فيديو</span>
                            </div>
                            <div class="video-info-wrap" style="padding: 12px;">
                                <h3 class="course-title" dir="auto" unicode-bidi="plaintext">${title}</h3>
                                <div class="video-meta" style="color:#1a73e8;font-size:1em;">
                                    <span>📺 ${stats.videoCount} فيديو</span>
                                    <span style="margin-right:10px;">📄 ${stats.fileCount} ملف</span>
                                    <span style="margin-right:10px;">📁 ${stats.folderCount} مجلد</span>
                                    <span style="margin-right:10px;">⏱️ ${stats.duration}</span>
                                </div>
                                <div class="video-desc">${description ? description.substring(0, 120) + (description.length > 120 ? '...' : '') : ''}</div>
                            </div>
                        </div>
                    `;
                });
                document.getElementById("playlists").innerHTML = html;
            });
        }

        let nextPageToken = null;

        async function fetchVideos(playlistId, append = false, folderPath = []) {
            currentPlaylistId = playlistId;
            currentFolderPath = folderPath || [];
            try {
                const API_KEY = "AIzaSyBMHmHT75657eKEa0fTxJAVS5vhnls7f44";
                let url = `https://www.googleapis.com/youtube/v3/playlistItems?key=${API_KEY}&playlistId=${playlistId}&part=snippet&maxResults=50`;
                // لا داعي للصفحات هنا لأننا سنبني شجرة كاملة
                const response = await fetch(url);
                const data = await response.json();

                // اجمع كل videoId
                const videoIds = data.items.map(item => item.snippet.resourceId.videoId).join(',');
                const videosDetailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${videoIds}&part=snippet,contentDetails,statistics`);
                const videosDetailsData = await videosDetailsRes.json();
                const detailsMap = {};
                videosDetailsData.items.forEach(item => detailsMap[item.id] = item);

                // --- بناء شجرة المجلدات والفيديوهات (بدون تكرار للجذر) ---
                const tree = {};
                data.items.forEach(item => {
                    const videoId = item.snippet.resourceId.videoId;
                    const details = detailsMap[videoId];
                    if (!details) return;
                    const desc = details.snippet.description || "";
                    // فقط السطر الأول يعتبر مسار إذا كان يبدأ بـ /
                    const firstLine = desc.split('\n')[0].trim();
                    let pathArr = [];
                    if (firstLine.startsWith('/') && !/^https?:\/\//i.test(firstLine)) {
                        pathArr = firstLine.split('/').filter(Boolean);
                    }
                    let node = tree;
                    if (pathArr.length > 0) {
                        for (let i = 0; i < pathArr.length; i++) {
                            const part = pathArr[i];
                            if (!node[part]) node[part] = {};
                            node = node[part];
                        }
                    }
                    // أضف الفيديو في المكان المناسب (الجذر إذا لم يوجد مسار)
                    if (!node._videos) node._videos = [];
                    node._videos.push({ item, details });
                });

                // --- عرض محتوى المجلد الحالي ---
                renderFolder(tree, folderPath || []);
            } catch (error) {
                document.getElementById("videos").innerHTML = `
                    <div class="error-message">
                        عذراً، حدث خطأ أثناء تحميل الفيديوهات.
                    </div>`;
            }
        }

        // دالة لحساب عدد الفيديوهات والمدة وعدد الملفات داخل مجلد (بما في ذلك المجلدات الفرعية)
        function getFolderStats(node) {
            let videoCount = 0;
            let fileCount = 0;
            let totalSeconds = 0;
            if (!node) return { videoCount, fileCount, totalSeconds };
            if (node._videos && node._videos.length > 0) {
                node._videos.forEach(({ details }) => {
                    if (details && details.contentDetails && details.contentDetails.duration) {
                        videoCount++;
                        totalSeconds += parseISODurationToSeconds(details.contentDetails.duration);
                    }
                    // استخراج الملفات المنفصلة من الوصف
                    let description = details.snippet.description || '';
                    let descLines = description.split('\n');
                    for (let i = 0; i < descLines.length; i++) {
                        let line = descLines[i].trim();
                        // تحقق من وجود رابط يليه سطر رقم(اسم)
                        const urlMatch = line.match(/^(https?:\/\/[^\s]+)$/i);
                        if (urlMatch && i + 1 < descLines.length) {
                            const nextLine = descLines[i + 1].trim();
                            const fileMatch = nextLine.match(/^(\d+)?\s*\(([^)]+)\)$/);
                            if (fileMatch) {
                                fileCount++;
                                i++;
                                continue;
                            }
                        }
                        // تحقق من وجود رابط ورقم(اسم) في نفس السطر
                        const inlineMatch = line.match(/^(https?:\/\/[^\s]+)\s*(\d+)?\s*\(([^)]+)\)$/i);
                        if (inlineMatch) {
                            fileCount++;
                            continue;
                        }
                    }
                });
            }
            Object.keys(node).forEach(key => {
                if (key !== "_videos" && key !== "playlistId") {
                    const stats = getFolderStats(node[key]);
                    videoCount += stats.videoCount;
                    fileCount += stats.fileCount;
                    totalSeconds += stats.totalSeconds;
                }
            });
            return { videoCount, fileCount, totalSeconds };
        }

        // دالة لتحويل ISO duration إلى ثواني
        function parseISODurationToSeconds(iso) {
            const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (!match) return 0;
            const [, h, m, s] = match.map(x => parseInt(x || '0', 10));
            return h * 3600 + m * 60 + s;
        }

        // دالة لتحويل ثواني إلى نص وقت hh:mm:ss أو mm:ss
        function formatSecondsToTime(secs) {
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = secs % 60;
            if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            return `${m}:${String(s).padStart(2, '0')}`;
        }

        // دالة لعرض محتوى مجلد معين حسب المسار
        function renderFolder(tree, folderPath) {
            let node = tree;
            for (const part of folderPath) {
                if (node && node[part]) {
                    node = node[part];
                } else {
                    node = null;
                    break;
                }
            }
            if (!node) {
                document.getElementById("videos").innerHTML = `<div class="error-message">هذا المجلد فارغ أو غير موجود.</div>`;
                return;
            }
            let html = "";

            // عرض المجلدات الفرعية مع عدد الفيديوهات والمدة وعدد الملفات
            Object.keys(node).forEach(key => {
                if (key === "_videos") return;
                const stats = getFolderStats(node[key]);
                html += `
                    <div class="course-container video-container video-responsive" onclick="navigateToFolder('${key}')">
                        <div class="video-thumb-wrap" style="width: 80px; min-width: 80px; height: 80px;">
                            <img src="صور/folder.gif" alt="Folder Icon" class="video-thumb" 
                                 style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">
                        </div>
                        <div class="video-info-wrap">
                            <h3 class="course-title" dir="auto" unicode-bidi="plaintext">${key}</h3>
                            <div class="video-meta" style="color:#1a73e8;font-size:1em;">
                                <span>📺 ${stats.videoCount} فيديو</span>
                                <span style="margin-right:10px;">📄 ${stats.fileCount} ملف</span>
                                <span style="margin-right:10px;">⏱️ ${formatSecondsToTime(stats.totalSeconds)}</span>
                            </div>
                        </div>
                    </div>
                `;
            });

            // --- تجميع الفيديوهات والملفات المنفصلة للترتيب ---
            let items = [];
            if (node._videos && node._videos.length > 0) {
                node._videos.forEach(({ item, details }) => {
                    const videoId = item.snippet.resourceId.videoId;
                    const title = details.snippet.title;
                    const thumbnail = details.snippet.thumbnails?.medium?.url || details.snippet.thumbnails?.default?.url || '';
                    const duration = formatDuration(details.contentDetails.duration);
                    const publishedAt = new Date(details.snippet.publishedAt).toLocaleDateString('ar-EG');
                    const views = details.statistics.viewCount ? details.statistics.viewCount.toLocaleString('ar-EG') : '-';
                    let description = details.snippet.description || '';

                    // استخراج الملفات المنفصلة (رقم(اسم))
                    let fileMatches = [];
                    let descLines = description.split('\n');
                    let filteredLines = [];
                    for (let i = 0; i < descLines.length; i++) {
                        let line = descLines[i].trim();
                        // تحقق من وجود رابط يليه سطر رقم(اسم)
                        const urlMatch = line.match(/^(https?:\/\/[^\s]+)$/i);
                        if (urlMatch && i + 1 < descLines.length) {
                            const nextLine = descLines[i + 1].trim();
                            const fileMatch = nextLine.match(/^(\d+)\s*\(([^)]+)\)$/);
                            if (fileMatch) {
                                fileMatches.push({
                                    order: parseInt(fileMatch[1], 10),
                                    url: urlMatch[1],
                                    label: fileMatch[2]
                                });
                                i++; // تخطى السطر التالى
                                continue;
                            }
                        }
                        // تحقق من وجود رابط ورقم(اسم) في نفس السطر
                        const inlineMatch = line.match(/^(https?:\/\/[^\s]+)\s*(\d+)\s*\(([^)]+)\)$/i);
                        if (inlineMatch) {
                            fileMatches.push({
                                order: parseInt(inlineMatch[2], 10),
                                url: inlineMatch[1],
                                label: inlineMatch[3]
                            });
                            continue;
                        }
                        filteredLines.push(line);
                    }
                    // أعد بناء الوصف بدون الملفات المنفصلة
                    description = filteredLines.join('\n');

                    // أضف الفيديو كعنصر للترتيب
                    items.push({
                        type: 'video',
                        order: null,
                        html: `
                            <div class="course-container video-container video-responsive video-row" onclick="openVideoPlayer('${videoId}')">
                                <div class="video-thumb-wrap video-thumb-video-wrap">
                                    <img src="${thumbnail}" alt="صورة مصغرة" class="video-thumb video-thumb-video">
                                    <span class="video-duration">${duration}</span>
                                </div>
                                <div class="video-info-wrap">
                                    <h3 class="course-title" dir="auto" unicode-bidi="plaintext">${title}</h3>
                                    <div class="video-meta">
                                        <span>📅 ${publishedAt}</span>
                                        <span>👁️ ${views} مشاهدة</span>
                                    </div>
                                    <div class="video-desc">${parseDescriptionWithHiddenLinks(description)}</div>
                                </div>
                            </div>
                        `
                    });

                    // أضف الملفات المنفصلة كعناصر مستقلة للترتيب
                    fileMatches.forEach(file => {
                        items.push({
                            type: 'file',
                            order: file.order,
                            html: `
                                <div class="course-container video-container video-responsive video-row">
                                    <div class="video-thumb-wrap video-thumb-video-wrap" style="display:flex;align-items:center;justify-content:center;background:#f8f9fa;">
                                        <span style="font-size:2.5em;color:#1a73e8;">📄</span>
                                    </div>
                                    <div class="video-info-wrap">
                                        <h3 class="course-title" dir="auto" unicode-bidi="plaintext">${file.label}</h3>
                                        <div class="video-meta">
                                            <span>ملف خاص بالفيديو</span>
                                        </div>
                                        <div>
                                            <button class="hidden-download-link" type="button" style="min-width:90px"
                                                onclick="(async function(btn){btn.disabled=true;btn.innerHTML='جاري التحقق...';const blob=await getFileFromDB('${file.url}');if(blob){btn.disabled=false;btn.innerHTML='${file.label}';openBlobFile(blob,'${file.url}');}else{btn.disabled=false;btn.innerHTML='${file.label}';downloadAndOpenFile('${file.url}',btn);}})(this)">
                                                ${file.label}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `
                        });
                    });
                });
            }

            // رتب العناصر: الملفات حسب order تصاعدي، الفيديوهات حسب ترتيبها الأصلي
            items.sort((a, b) => {
                if (a.order != null && b.order != null) return a.order - b.order;
                if (a.order != null) return a.order - 0.5; // الملفات قبل الفيديوهات إذا نفس الترتيب
                if (b.order != null) return 0.5 - b.order;
                return 0; // ترتيب الفيديوهات كما هي
            });

            items.forEach(item => { html += item.html; });

            document.getElementById("playlists").style.display = "none";
            document.getElementById("videos").style.display = "grid";
            document.getElementById("back-button").style.display = folderPath.length > 0 ? "block" : "none";
            document.getElementById("back-to-landing-btn").style.display = "none";
            document.getElementById("videos").innerHTML = html || `<div class="error-message">لا يوجد محتوى في هذا المجلد.</div>`;
        }

        // دالة التنقل داخل المجلدات
        window.navigateToFolder = function(folderName) {
            const newPath = [...currentFolderPath, folderName];
            fetchVideos(currentPlaylistId, false, newPath);
        };

        // زر الرجوع للمجلد الأعلى
        document.getElementById("back-button").onclick = function() {
            if (currentFolderPath.length > 0) {
                const newPath = currentFolderPath.slice(0, -1);
                fetchVideos(currentPlaylistId, false, newPath);
            } else {
                // رجوع لقوائم التشغيل
                document.getElementById("playlists").style.display = "grid";
                document.getElementById("videos").style.display = "none";
                document.getElementById("back-button").style.display = "none";
                document.getElementById("load-more-button").style.display = "none";
            }
        };

        function formatDuration(isoDuration) {
            // مثال: PT1H2M3S
            const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (!match) return '';
            const [, h, m, s] = match.map(x => parseInt(x || '0', 10));
            if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            return `${m}:${String(s).padStart(2, '0')}`;
        }

        // تعديل دالة الروابط المخفية لإضافة زر التنزيل مع التقدم وترتيب حسب الرقم قبل القوسين
        function parseDescriptionWithHiddenLinks(desc) {
            if (!desc) return '';
            let result = '';
            const lines = desc.split('\n');
            let i = 0;
            let foundAny = false;
            // نجمع الأزرار مع ترتيبها
            let downloadButtons = [];
            while (i < lines.length) {
                const line = lines[i].trim();
                // تحقق إذا كان السطر رابط تحميل مباشر
                const urlMatch = line.match(/^(https?:\/\/[^\s]+)$/i);
                if (urlMatch && i + 1 < lines.length) {
                    const nextLine = lines[i + 1].trim();
                    // دعم الرقم قبل القوسين: مثال 3(ewewr)
                    const parenMatch = nextLine.match(/^(\d+)?\s*\(([^)]+)\)$/);
                    if (parenMatch) {
                        if (!foundAny) {
                            result += `<div style="font-weight:bold;color:#1a73e8;margin:6px 0 2px 0;">الملفات الخاصة بالفديو</div>`;
                            foundAny = true;
                        }
                        // إذا وجد رقم، استخدمه للترتيب
                        const order = parenMatch[1] ? parseInt(parenMatch[1], 10) : null;
                        const label = parenMatch[2];
                        downloadButtons.push({ order, html: getDownloadButtonHTML(urlMatch[1], label) });
                        i += 2;
                        continue;
                    }
                }
                // تحقق من وجود رابط يليه نص بين قوسين في نفس السطر مع رقم
                const inlineMatch = line.match(/^(https?:\/\/[^\s]+)\s*(\d+)?\s*\(([^)]+)\)$/i);
                if (inlineMatch) {
                    if (!foundAny) {
                        result += `<div style="font-weight:bold;color:#1a73e8;margin:6px 0 2px 0;">الملفات الخاصة بالفديو</div>`;
                        foundAny = true;
                    }
                    const order = inlineMatch[2] ? parseInt(inlineMatch[2], 10) : null;
                    const label = inlineMatch[3];
                    downloadButtons.push({ order, html: getDownloadButtonHTML(inlineMatch[1], label) });
                    i++;
                    continue;
                }
                result += `<div>${line}</div>`;
                i++;
            }
            // رتب الأزرار حسب order إذا وجد، وإلا بالترتيب الطبيعي
            if (downloadButtons.length > 0) {
                downloadButtons
                    .sort((a, b) => {
                        if (a.order == null && b.order == null) return 0;
                        if (a.order == null) return 1;
                        if (b.order == null) return -1;
                        return a.order - b.order;
                    })
                    .forEach(btn => { result += btn.html; });
            }
            return result;
        }

        // Helper: زر التنزيل الذكي
        function getDownloadButtonHTML(url, label) {
            // زر باسم الملف، عند الضغط يتحقق من وجوده في IndexedDB
            const btnId = "dlbtn-" + Math.random().toString(36).slice(2, 10);
            setTimeout(() => {
                const btn = document.getElementById(btnId);
                if (!btn) return;
                btn.innerHTML = label;
                btn.setAttribute("data-label", label);
                btn.onclick = async function(e) {
                    e.stopPropagation();
                    if (btn.getAttribute("data-downloading")) return;
                    btn.disabled = true;
                    btn.innerHTML = '<span style="color:#1a73e8;">جاري التحقق...</span>';
                    // تحقق من وجود الملف
                    const blob = await getFileFromDB(url);
                    if (blob) {
                        btn.disabled = false;
                        btn.innerHTML = label;
                        openBlobFile(blob, url);
                    } else {
                        btn.disabled = false;
                        btn.innerHTML = label;
                        downloadAndOpenFile(url, btn);
                    }
                };
            }, 0);
            return `<div style="margin:4px 0;">
                <button id="${btnId}" class="hidden-download-link" type="button" style="min-width:90px"></button>
            </div>`;
        }

        function renderVideos(videos, detailsMap, append = false) {
            let html = "";
            videos.forEach(video => {
                const videoId = video.snippet.resourceId.videoId;
                const details = detailsMap[videoId];
                if (!details) return;

                const title = details.snippet.title;
                const thumbnail = details.snippet.thumbnails?.medium?.url || details.snippet.thumbnails?.default?.url || '';
                const duration = formatDuration(details.contentDetails.duration);
                const publishedAt = new Date(details.snippet.publishedAt).toLocaleDateString('ar-EG');
                const views = details.statistics.viewCount ? details.statistics.viewCount.toLocaleString('ar-EG') : '-';
                const description = details.snippet.description ? parseDescriptionWithHiddenLinks(
                    // إخفاء السطر الأول إذا كان مسار
                    (() => {
                        let desc = details.snippet.description;
                        if (desc) {
                            const lines = desc.split('\n');
                            if (lines[0].trim().startsWith('/') && !/^https?:\/\//i.test(lines[0].trim())) {
                                lines.shift();
                                desc = lines.join('\n');
                            }
                        }
                        return desc;
                    })()
                ) : '';

                html += `
                    <div class="course-container video-container video-responsive video-row" onclick="openVideoPlayer('${videoId}')">
                        <div class="video-thumb-wrap video-thumb-video-wrap">
                            <img src="${thumbnail}" alt="صورة مصغرة" class="video-thumb video-thumb-video">
                            <span class="video-duration">${duration}</span>
                        </div>
                        <div class="video-info-wrap">
                            <h3 class="course-title" dir="auto" unicode-bidi="plaintext">${title}</h3>
                            <div class="video-meta">
                                <span>📅 ${publishedAt}</span>
                                <span>👁️ ${views} مشاهدة</span>
                            </div>
                            <div class="video-desc">${description}</div>
                        </div>
                    </div>
                `;
            });

            if (append) {
                document.getElementById("videos").innerHTML += html;
            } else {
                document.getElementById("videos").innerHTML = html;
            }

            document.getElementById("playlists").style.display = "none";
            document.getElementById("videos").style.display = "grid";
            document.getElementById("back-button").style.display = "block";
            document.getElementById("back-to-landing-btn").style.display = "none";
        }

        function renderVideosLand(videos, detailsMap, append = false) {
            let html = "";
            videos.forEach(video => {
                const videoId = video.snippet.resourceId.videoId;
                const details = detailsMap[videoId];
                if (!details) return;

                const title = details.snippet.title;
                const thumbnail = details.snippet.thumbnails?.medium?.url || details.snippet.thumbnails?.default?.url || '';
                const duration = formatDuration(details.contentDetails.duration);
                const publishedAt = new Date(details.snippet.publishedAt).toLocaleDateString('ar-EG');
                const views = details.statistics.viewCount ? details.statistics.viewCount.toLocaleString('ar-EG') : '-';
                const description = details.snippet.description ? parseDescriptionWithHiddenLinks(
                    // إخفاء السطر الأول إذا كان مسار
                    (() => {
                        let desc = details.snippet.description;
                        if (desc) {
                            const lines = desc.split('\n');
                            if (lines[0].trim().startsWith('/') && !/^https?:\/\//i.test(lines[0].trim())) {
                                lines.shift();
                                desc = lines.join('\n');
                            }
                        }
                        return desc;
                    })()
                ) : '';

                html += `
                    <div class="course-container video-container video-responsive video-row" onclick="openVideoPlayer('${videoId}')">
                        <div class="video-thumb-wrap video-thumb-video-wrap">
                            <img src="${thumbnail}" alt="صورة مصغرة" class="video-thumb video-thumb-video">
                            <span class="video-duration">${duration}</span>
                        </div>
                        <div class="video-info-wrap">
                            <h3 class="course-title" dir="auto" unicode-bidi="plaintext">${title}</h3>
                            <div class="video-meta">
                                <span>📅 ${publishedAt}</span>
                                <span>👁️ ${views} مشاهدة</span>
                            </div>
                            <div class="video-desc">${description}</div>
                        </div>
                    </div>
                `;
            });
            if (append) {
                document.getElementById("videos-land").innerHTML += html;
            } else {
                document.getElementById("videos-land").innerHTML = html;
            }
            document.getElementById("playlists-land").style.display = "none";
            document.getElementById("videos-land").style.display = "grid";
            document.getElementById("back-button-land").style.display = "block";
        }
