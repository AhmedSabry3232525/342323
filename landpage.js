async function showPlaylistsLand() {
    try {
        // إعادة تعيين حالة العرض والمتغيرات عند كل دخول
        document.getElementById("playlists-land").style.display = "grid";
        document.getElementById("videos-land").style.display = "none";
        document.getElementById("back-button-land").style.display = "none";
        document.getElementById("load-more-button-land").style.display = "none";
        nextPageTokenLand = null;
        currentPlaylistIdLand = null;

        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await db.collection("pendingUsers").doc(user.uid).get();
        if (!userDoc.exists) return;

        const userPlaylists = userDoc.data().playlists || {};
        const visiblePlaylists = Object.keys(userPlaylists)
            .filter(key => userPlaylists[key] === true)
            .map(key => unlistedPlaylistIds[parseInt(key, 10) - 1]);

        if (visiblePlaylists.length === 0) {
            document.getElementById("playlists-land").innerHTML = `
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
            // دالة مساعدة لحساب الإحصائيات لكل قائمة تشغيل
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

            // استخدم Promise.all لجلب الإحصائيات لكل قائمة تشغيل
            const statsPromises = data.items.map(pl => getPlaylistStats(pl.id));
            Promise.all(statsPromises).then(statsArr => {
                const html = data.items.map((playlist, idx) => {
                    // استخراج روابط الصور من أول سطرين للوصف
                    let description = playlist.snippet.description || '';
                    let descLines = description.split('\n').map(l => l.trim()).filter(Boolean);
                    let customThumb = '';
                    let customCircle = '';
                    if (descLines[0] && /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)$/i.test(descLines[0])) {
                        customThumb = descLines[0];
                    }
                    if (descLines[1] && /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)$/i.test(descLines[1])) {
                        customCircle = descLines[1];
                    }
                    const thumbnail = customThumb || playlist.snippet.thumbnails?.medium?.url || playlist.snippet.thumbnails?.default?.url || '';
                    return `
                        <div class="course-container video-container video-responsive" 
                             onclick="fetchVideosLand('${playlist.id}')" 
                             style="flex-direction: column; padding: 0;">
                            <div class="video-thumb-wrap playlist-thumb" style="width: 100%; max-width: 100%; margin-bottom: 10px; position:relative;">
                                <img src="${thumbnail}" alt="صورة مصغرة" class="video-thumb" style="width: 100%; height: 180px; object-fit:cover;">
                                ${customCircle ? `<img src="${customCircle}" alt="صورة دائرية" style="position:absolute;bottom:12px;left:12px;width:60px;height:60px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px #0003;object-fit:cover;background:#fff;">` : ''}
                                <span class="video-duration">${playlist.contentDetails?.itemCount || '-'} عدد الفديوهات</span>
                            </div>
                            <div class="video-info-wrap" style="padding: 12px;">
                                <h3 class="course-title" dir="auto" unicode-bidi="plaintext">${playlist.snippet.title}</h3>
                                <div class="video-meta" style="color:#1a73e8;font-size:1em;">
                                    <span>📺 ${statsArr[idx].videoCount} فيديو</span>
                                    <span style="margin-right:10px;">📄 ${statsArr[idx].fileCount} ملف</span>
                                    <span style="margin-right:10px;">📁 ${statsArr[idx].folderCount} مجلد</span>
                                    <span style="margin-right:10px;">⏱️ ${statsArr[idx].duration}</span>
                                </div>
                                <div class="video-desc">${description ? description.substring(0, 120) + (description.length > 120 ? '...' : '') : ''}</div>
                            </div>
                        </div>
                    `;
                }).join('');
                document.getElementById("playlists-land").innerHTML = html;
            });
        }
    } catch (error) {
        document.getElementById("playlists-land").innerHTML = `
            <div class="error-message">
                عذراً، حدث خطأ أثناء تحميل قوائم التشغيل.
            </div>`;
    }
}

window.fetchVideosLand = async function(playlistId, append = false) {
    try {
        currentPlaylistIdLand = playlistId;
        const API_KEY = "AIzaSyBMHmHT75657eKEa0fTxJAVS5vhnls7f44";
        // فقط عند أول تحميل (ليس عند تحميل المزيد)
        if (!append) {
            const playlistInfoRes = await fetch(`https://www.googleapis.com/youtube/v3/playlists?key=${API_KEY}&id=${playlistId}&part=snippet`);
            const playlistInfoData = await playlistInfoRes.json();
            if (playlistInfoData.items && playlistInfoData.items.length > 0) {
                document.getElementById("landpage-title").textContent = playlistInfoData.items[0].snippet.title;
            } else {
                document.getElementById("landpage-title").textContent = "قائمة الفيديوهات الخاصة بالكورس";
            }
        }
        let url = `https://www.googleapis.com/youtube/v3/playlistItems?key=${API_KEY}&playlistId=${playlistId}&part=snippet&maxResults=5`;
        if (nextPageTokenLand) {
            url += `&pageToken=${nextPageTokenLand}`;
        }
        const response = await fetch(url);
        const data = await response.json();
        nextPageTokenLand = data.nextPageToken || null;

        // اجمع كل videoId
        const videoIds = data.items.map(item => item.snippet.resourceId.videoId).join(',');
        // استدعاء إضافي لجلب التفاصيل
        const videosDetailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${videoIds}&part=snippet,contentDetails,statistics`);
        const videosDetailsData = await videosDetailsRes.json();
        const detailsMap = {};
        videosDetailsData.items.forEach(item => detailsMap[item.id] = item);

        renderVideosLand(data.items, detailsMap, append);

        if (nextPageTokenLand) {
            document.getElementById("load-more-button-land").style.display = "block";
        } else {
            document.getElementById("load-more-button-land").style.display = "none";
        }
    } catch (error) {
        document.getElementById("videos-land").innerHTML = `
            <div class="error-message">
                عذراً، حدث خطأ أثناء تحميل الفيديوهات.
            </div>`;
    }
};

document.getElementById("back-button-land").addEventListener("click", function() {
    document.getElementById("playlists-land").style.display = "grid";
    document.getElementById("videos-land").style.display = "none";
    document.getElementById("back-button-land").style.display = "none";
    document.getElementById("load-more-button-land").style.display = "none";
    nextPageTokenLand = null;
    // عند الرجوع غيّر العنوان للنص الأصلي
    document.getElementById("landpage-title").textContent = "قائمة المجلدات الخاصة بكل كورس فديوهات فقط";
});

document.getElementById("load-more-button-land").addEventListener("click", function() {
    if (currentPlaylistIdLand) {
        fetchVideosLand(currentPlaylistIdLand, true);
    }
});

// زر الرجوع للصفحة الرئيسية
document.getElementById("back-to-landing-btn").addEventListener("click", function() {
    document.querySelector(".welcome-container").style.display = "block";
    document.getElementById("playlists").style.display = "none";
    document.getElementById("videos").style.display = "none";
    document.getElementById("back-to-landing-btn").style.display = "none";
    document.getElementById("back-button").style.display = "none";
    document.getElementById("load-more-button").style.display = "none";
});

// امسح sessionStorage عند الخروج من الموقع
window.addEventListener('beforeunload', function() {
    sessionStorage.clear();
});

// منطق إظهار/إخفاء النماذج
document.getElementById('show-register-form-btn').onclick = function() {
    document.getElementById('register-form').style.display = 'block';
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('forgot-password-form').style.display = 'none'; // أضف هذا السطر
    this.style.background = '#1a73e8';
    this.style.color = 'white';
    document.getElementById('show-login-form-btn').style.background = '#e0e0e0';
    document.getElementById('show-login-form-btn').style.color = '#222';
};
document.getElementById('show-login-form-btn').onclick = function() {
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('forgot-password-form').style.display = 'none'; // أضف هذا السطر
    this.style.background = '#34a853';
    this.style.color = 'white';
    document.getElementById('show-register-form-btn').style.background = '#e0e0e0';
    document.getElementById('show-register-form-btn').style.color = '#222';
};
// الوضع الافتراضي: إظهار نموذج التسجيل
document.getElementById('show-register-form-btn').click();

// إظهار/إخفاء نموذج استرجاع كلمة المرور
document.getElementById('show-forgot-password').onclick = function(e) {
    e.preventDefault();
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('forgot-password-form').style.display = 'block';
    document.getElementById('forgot-password-result').textContent = '';
};
document.getElementById('back-to-login').onclick = function(e) {
    e.preventDefault();
    document.getElementById('forgot-password-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('forgot-password-result').textContent = '';
};

document.addEventListener('DOMContentLoaded', function() {
    var copyBtn = document.getElementById('copy-waiting-info-btn');
    if (copyBtn) {
        copyBtn.onclick = function() {
            var name = document.getElementById('waiting-name').textContent.trim();
            var email = document.getElementById('waiting-email').textContent.trim();
            var phone = document.getElementById('waiting-phone').textContent.trim();
            // كل معلومة مع عنوانها في سطر منفصل
            var text = "الاسم: " + name + "\n" +
                       "الإيميل: " + email + "\n" +
                       "رقم الهاتف: " + phone;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(function() {
                    var msg = document.getElementById('copy-waiting-info-msg');
                    if (msg) {
                        msg.style.display = 'block';
                        setTimeout(function() { msg.style.display = 'none'; }, 1500);
                    }
                });
            } else {
                var textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                try { document.execCommand('copy'); } catch(e){}
                document.body.removeChild(textarea);
                var msg = document.getElementById('copy-waiting-info-msg');
                if (msg) {
                    msg.style.display = 'block';
                    setTimeout(function() { msg.style.display = 'none'; }, 1500);
                }
            }
        };
    }
});

// Settings button logic
document.getElementById('settings-btn').onclick = function() {
    // حركة ديناميكية عند الضغط
    this.classList.add('spinning');
    setTimeout(() => this.classList.remove('spinning'), 700);

    // Get user data from localStorage
    let userData = {};
    try {
        userData = JSON.parse(localStorage.getItem('userData')) || {};
    } catch(e) {}
    document.getElementById('account-info-name').textContent = userData.name || '--';
    document.getElementById('account-info-email').textContent = userData.email || '--';
    document.getElementById('account-info-phone').textContent = userData.phone || '--';
    document.getElementById('account-info-modal').style.display = 'flex';
};
document.getElementById('close-account-info').onclick = function() {
    document.getElementById('account-info-modal').style.display = 'none';
};
// Optional: close modal when clicking outside the box
document.getElementById('account-info-modal').onclick = function(e) {
    if (e.target === this) this.style.display = 'none';
};

// إضافة دالة إظهار/إخفاء كلمة المرور
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🔓";
    } else {
        input.type = "password";
        btn.textContent = "🔒";
    }
}