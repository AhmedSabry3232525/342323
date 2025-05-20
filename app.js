// --- متغيرات land page للشجرة ---
        let treeLand = null;
        let currentFolderPathLand = [];

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
            // مثال: PT1H2M3S
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

        // عدل دالة fetchVideosLand لتبني الشجرة وتعرض المجلدات والفيديوهات
        window.fetchVideosLand = async function(playlistId, append = false, folderPath = []) {
            try {
                currentPlaylistIdLand = playlistId;
                currentFolderPathLand = folderPath || [];
                // فقط عند أول تحميل (ليس عند تحميل المزيد)
                if (!append && (!treeLand || playlistId !== treeLand?.playlistId)) {
                    // جلب كل الفيديوهات دفعة واحدة (بدون صفحات)
                    const API_KEY = "AIzaSyBMHmHT75657eKEa0fTxJAVS5vhnls7f44";
                    const playlistInfoRes = await fetch(`https://www.googleapis.com/youtube/v3/playlists?key=${API_KEY}&id=${playlistId}&part=snippet`);
                    const playlistInfoData = await playlistInfoRes.json();
                    if (playlistInfoData.items && playlistInfoData.items.length > 0) {
                        document.getElementById("landpage-title").textContent = playlistInfoData.items[0].snippet.title;
                    } else {
                        document.getElementById("landpage-title").textContent = "قائمة الفيديوهات الخاصة بالكورس";
                    }

                    // جلب كل الفيديوهات (قد تحتاج إلى صفحات إذا كانت كثيرة)
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

                    // --- بناء شجرة المجلدات والفيديوهات (بدون تكرار للجذر) ---
                    treeLand = { playlistId };
                    allItems.forEach(item => {
                        const videoId = item.snippet.resourceId.videoId;
                        const details = detailsMap[videoId];
                        if (!details) return;
                        const desc = details.snippet.description || "";
                        // استخراج أول مسار يبدأ بـ /
                        const pathMatch = desc.split('\n')[0].trim();
                        let pathArr = [];
                        if (pathMatch.startsWith('/') && !/^https?:\/\//i.test(pathMatch)) {
                            pathArr = pathMatch.split('/').filter(Boolean);
                        }
                        let node = treeLand;
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
                }

                // --- عرض محتوى المجلد الحالي ---
                renderFolderLand(treeLand, currentFolderPathLand);

            } catch (error) {
                document.getElementById("videos-land").innerHTML = `
                    <div class="error-message">
                        عذراً، حدث خطأ أثناء تحميل الفيديوهات.
                    </div>`;
            }
        };

        // دالة لعرض مجلد معين في land page
        function renderFolderLand(tree, folderPath) {
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
                document.getElementById("videos-land").innerHTML = `<div class="error-message">هذا المجلد فارغ أو غير موجود.</div>`;
                document.getElementById("playlists-land").style.display = "none";
                document.getElementById("videos-land").style.display = "grid";
                document.getElementById("back-button-land").style.display = folderPath.length > 0 ? "block" : "none";
                return;
            }
            let html = "";

            // عرض المجلدات الفرعية مع عدد الفيديوهات والمدة وعدد الملفات
            Object.keys(node).forEach(key => {
                if (key === "_videos" || key === "playlistId") return;
                const stats = getFolderStats(node[key]);
                html += `
                    <div class="course-container video-container video-responsive" onclick="navigateToFolderLand('${key}')">
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

            // --- بناء مصفوفة موحدة للعرض (الفيديوهات والملفات المنفصلة) حسب الترتيب ---
            let allItems = [];
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

                    // أضف الفيديو كعنصر للعرض (بدون order)
                    allItems.push({
                        type: 'video',
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

                    // أضف الملفات المنفصلة كعناصر للعرض مع order (الرقم)
                    fileMatches.forEach(file => {
                        allItems.push({
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

                let finalItems = [];
                // اجمع كل الملفات المنفصلة ورتبها حسب order
                let files = allItems.filter(x => x.type === 'file').sort((a, b) => a.order - b.order);
                let videos = allItems.filter(x => x.type === 'video');
                let totalCount = files.length + videos.length;
                // مصفوفة تمثل أماكن العناصر (index يبدأ من 0)
                let slots = [];
                // ضع كل ملف منفصل في مكانه الصحيح (order-1)
                files.forEach(file => {
                    // إذا كان هناك عنصر بالفعل في هذا المكان، أزح الباقي للأمام
                    let idx = file.order - 1;
                    while (slots[idx]) idx++;
                    slots[idx] = file;
                });
                // ضع الفيديوهات في الأماكن الفارغة بالترتيب
                let v = 0;
                for (let i = 0; i < totalCount + 10; i++) {
                    if (!slots[i] && v < videos.length) {
                        slots[i] = videos[v];
                        v++;
                    }
                }
                // بناء القائمة النهائية
                slots.forEach(item => { if (item) html += item.html; });
            }

            document.getElementById("playlists-land").style.display = "none";
            document.getElementById("videos-land").style.display = "grid";
            document.getElementById("back-button-land").style.display = folderPath.length > 0 ? "block" : "none";
            document.getElementById("videos-land").innerHTML = html || `<div class="error-message">لا يوجد محتوى في هذا المجلد.</div>`;
        }

        // دالة التنقل داخل المجلدات في land page
        window.navigateToFolderLand = function(folderName) {
            const newPath = [...currentFolderPathLand, folderName];
            fetchVideosLand(currentPlaylistIdLand, false, newPath);
        };

        // زر الرجوع للمجلد الأعلى في land page
        document.getElementById("back-button-land").onclick = function() {
            if (currentFolderPathLand.length > 0) {
                const newPath = currentFolderPathLand.slice(0, -1);
                fetchVideosLand(currentPlaylistIdLand, false, newPath);
            } else {
                // رجوع لقوائم التشغيل land
                document.getElementById("playlists-land").style.display = "grid";
                document.getElementById("videos-land").style.display = "none";
                document.getElementById("back-button-land").style.display = "none";
                document.getElementById("load-more-button-land").style.display = "none";
                treeLand = null;
                currentFolderPathLand = [];
                document.getElementById("landpage-title").textContent = "قائمة المجلدات الخاصة بكل كورس فديوهات فقط";
            }
        };
