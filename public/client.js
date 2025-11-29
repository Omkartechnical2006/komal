document.addEventListener("DOMContentLoaded", () => {
  const messages = document.getElementById("messages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const clearBtn = document.getElementById("clearBtn");

  // Videos
  const firstVideo = document.getElementById("firstVideo");
  const idleVideo = document.getElementById("idleVideo");
  const talkVideo = document.getElementById("talkVideo");

  function showOnly(el) {
    [firstVideo, idleVideo, talkVideo].forEach((v) => {
      if (!v) return;
      v.pause();
      v.classList.remove("active");
    });
    if (el) {
      el.classList.add("active");
      el.currentTime = 0;
      const p = el.play();
      if (p) p.catch(() => {});
    }
  }

  // Initial video flow: play first once, then idle loops
  if (firstVideo) {
    firstVideo.loop = false;
    firstVideo.addEventListener("ended", () => showOnly(idleVideo));
    showOnly(firstVideo);
  } else {
    showOnly(idleVideo);
  }
  if (idleVideo) idleVideo.loop = true;
  if (talkVideo) talkVideo.loop = true;

  function createDeleteButton() {
    const btn = document.createElement("button");
    btn.className = "delete-btn";
    btn.title = "Delete";
    btn.textContent = "🗑️";
    return btn;
  }

  function addMessage(role, text, id) {
    const item = document.createElement("div");
    item.className = `msg ${role}`;
    if (id) item.dataset.id = id;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    item.appendChild(bubble);
    item.appendChild(createDeleteButton());
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    return item;
  }

  // Voice selection for Hindi female voice (best-effort)
  function pickVoice() {
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    let v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith("hi"));
    if (!v) v = voices.find((x) => x.lang && x.lang.toLowerCase().includes("en-in"));
    if (!v && voices.length) v = voices[0];
    return v || null;
  }

  function speakReply(text) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) utter.voice = v;
      utter.rate = 0.95;
      utter.pitch = 1.0;
      utter.onstart = () => {
        showOnly(talkVideo);
      };
      utter.onend = () => {
        showOnly(idleVideo);
        resolve();
      };
      utter.onerror = () => {
        showOnly(idleVideo);
        resolve();
      };
      try {
        speechSynthesis.cancel();
        speechSynthesis.speak(utter);
      } catch (_) {
        resolve();
      }
    });
  }

  // Delete single message via event delegation
  messages.addEventListener("click", async (e) => {
    const target = e.target;
    if (target.classList.contains("delete-btn")) {
      const msgEl = target.closest(".msg");
      const id = msgEl?.dataset?.id;
      if (!id) return; // no id, cannot delete from DB
      const ok = confirm("Delete this message?");
      if (!ok) return;
      try {
        const res = await fetch(`/messages/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.ok) {
          msgEl.remove();
        }
      } catch (_) {}
    }
  });

  // Clear chat
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      const ok = confirm("Clear entire chat?");
      if (!ok) return;
      try {
        const res = await fetch("/messages", { method: "DELETE" });
        const data = await res.json();
        if (data.ok) {
          messages.innerHTML = "";
        }
      } catch (_) {}
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = (input.value || "").trim();
    if (!text) return;
    const userEl = addMessage("user", text);

    input.value = "";
    input.disabled = true;
    sendBtn.disabled = true;

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (data.userId) userEl.dataset.id = data.userId;
      if (data.reply) {
        addMessage("komal", data.reply, data.komalId);
        await speakReply(data.reply);
      } else {
        addMessage("komal", data.error || "Sorry, I couldn’t respond.");
      }
    } catch (err) {
      addMessage("komal", "Network error, please try again.");
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  });

  // Ensure voices are loaded (Chrome loads asynchronously)
  if (window.speechSynthesis) {
    speechSynthesis.onvoiceschanged = () => {};
  }
});