// Set data-discord-user-id on #discord-presence in index.html to your numeric Discord user ID.
// Join https://discord.gg/lanyard first. No bot token or password is needed.
(() => {
    "use strict";
    const card = document.getElementById("discord-presence");
    const userId = card?.dataset.discordUserId?.trim();
    if (!card || !/^\d{17,21}$/.test(userId || "")) return;
    card.hidden = false;
    const $ = (id) => document.getElementById(id);
    const statusNode = $("discord-status");
    const nameNode = $("discord-name");
    const activityNode = $("discord-activity");
    const detailNode = $("discord-detail");
    const avatarNode = $("discord-avatar");
    const artNode = $("discord-activity-image");
    const statuses = {online:"Online", idle:"Idle", dnd:"Do Not Disturb", offline:"Offline"};
    let socket = null;
    let heartbeat = null;
    let retry = null;
    let retryDelay = 1500;
    let lastUpdate = 0;
    let stopped = false;

    function setImage(el, url) {
        if (typeof url !== "string" || !/^https:\/\//i.test(url)) {
            el.hidden = true;
            el.removeAttribute("src");
            return;
        }
        el.src = url;
        el.hidden = false;
    }
    function render(data) {
        if (!data || typeof data !== "object") return;
        lastUpdate = Date.now();
        retryDelay = 1500;
        const status = Object.hasOwn(statuses, data.discord_status) ? data.discord_status : "offline";
        card.dataset.status = status;
        statusNode.textContent = statuses[status];
        const user = data.discord_user || {};
        nameNode.textContent = user.global_name || user.display_name || user.username || "Discord";
        const avatar = user.avatar && user.id
            ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.${String(user.avatar).startsWith("a_") ? "gif" : "png"}?size=128`
            : null;
        setImage(avatarNode, avatar);
        const activities = Array.isArray(data.activities) ? data.activities : [];
        const playing = activities.find(a => a && a.type === 0) ||
            activities.find(a => a && a.type !== 4 && a.type !== 2);
        const spotify = data.listening_to_spotify && data.spotify ? data.spotify : null;
        let title = "Not currently playing";
        let detail = "";
        let image = null;
        if (playing) {
            title = `Playing ${playing.name || "a game"}`;
            detail = [playing.details, playing.state].filter(Boolean).join(" · ");
            const asset = playing.assets?.large_image;
            if (typeof asset === "string" && /^https:\/\//.test(asset)) image = asset;
            else if (typeof asset === "string" && asset.startsWith("mp:")) image = `https://media.discordapp.net/${asset.slice(3)}`;
            else if (typeof asset === "string" && /^\d+$/.test(playing.application_id || "")) {
                image = `https://cdn.discordapp.com/app-assets/${playing.application_id}/${encodeURIComponent(asset)}.png`;
            }
        } else if (spotify) {
            title = `Listening to ${spotify.song || "Spotify"}`;
            detail = spotify.artist || "";
            image = spotify.album_art_url || null;
        } else if (status === "offline") {
            title = "Currently offline";
        } else if (status === "idle") {
            title = "Away from keyboard";
        } else if (status === "dnd") {
            title = "Busy";
        } else {
            title = "Online on Discord";
        }
        activityNode.textContent = title;
        detailNode.textContent = detail;
        detailNode.hidden = !detail;
        setImage(artNode, image);
    }
    function unavailable() {
        if (Date.now() - lastUpdate < 90000) return;
        card.dataset.status = "unknown";
        statusNode.textContent = "Unavailable";
        activityNode.textContent = "Discord status unavailable";
        detailNode.hidden = true;
        artNode.hidden = true;
    }
    async function initialFetch() {
        try {
            const response = await fetch(`https://api.lanyard.rest/v1/users/${userId}`, {cache:"no-store"});
            if (!response.ok) throw new Error("Presence request failed");
            const payload = await response.json();
            if (payload.success && payload.data) render(payload.data);
            else unavailable();
        } catch (_) { unavailable(); }
    }
    function cleanupSocket() {
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        if (socket) {
            socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
            try { socket.close(); } catch (_) {}
        }
        socket = null;
    }
    function connect() {
        if (stopped) return;
        cleanupSocket();
        try { socket = new WebSocket("wss://api.lanyard.rest/socket"); }
        catch (_) { scheduleRetry(); return; }
        socket.onmessage = (event) => {
            let message;
            try { message = JSON.parse(event.data); } catch (_) { return; }
            if (message.op === 1) {
                const interval = Math.max(1000, Number(message.d?.heartbeat_interval) || 30000);
                socket.send(JSON.stringify({op:2,d:{subscribe_to_id:userId}}));
                heartbeat = setInterval(() => {
                    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({op:3}));
                }, interval);
            } else if (message.op === 0 && ["INIT_STATE","PRESENCE_UPDATE"].includes(message.t)) {
                render(message.d);
            }
        };
        socket.onerror = () => socket?.close();
        socket.onclose = () => {
            if (heartbeat) clearInterval(heartbeat);
            heartbeat = null;
            scheduleRetry();
        };
    }
    function scheduleRetry() {
        if (stopped || retry) return;
        retry = setTimeout(() => {
            retry = null;
            unavailable();
            void initialFetch();
            connect();
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 60000);
    }
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && Date.now() - lastUpdate > 60000) void initialFetch();
    });
    window.addEventListener("pagehide", () => {
        stopped = true;
        clearTimeout(retry);
        cleanupSocket();
    }, {once:true});
    void initialFetch();
    connect();
})();
