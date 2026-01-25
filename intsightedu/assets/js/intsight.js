/* assets/js/intsight.js */

/**
 * Alpine component for homepage state (menu + course filter + course data)
 * Keeps HTML clean while staying lightweight.
 */
function intsightHome() {
  return {
    mobileMenu: false,
    courseFilter: "all",
    courses: [
      {
        id: 1,
        type: "group",
        tag: "Test Prep",
        sub: "Standardized",
        title: "SAT Digital Mastery: Intensive Course",
        desc: "เจาะลึกเทคนิคการทำข้อสอบ SAT Digital ทั้งส่วน Reading & Writing และ Math ครบทุกหัวข้อ",
        hours: "48 Hours",
        start: "Starts Feb 15",
        badge: "Open for Enrollment",
        img: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=1200",
      },
      {
        id: 2,
        type: "group",
        tag: "IELTS",
        sub: "English",
        title: "IELTS Academic: Band 7.5 Strategy",
        desc: "คอร์สเน้นกลยุทธ์ทำคะแนน IELTS สำหรับยื่นคณะอินเตอร์ จุฬาฯ และธรรมศาสตร์ โดยเฉพาะ",
        hours: "32 Hours",
        start: "Starts Mar 01",
        badge: "Fast Track",
        img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1200",
      },
      {
        id: 3,
        type: "private",
        tag: "IB Diploma",
        sub: "Internal Assessment",
        title: "IB Economics & Math AA HL Bootcamp",
        desc: "ติวเข้มโค้งสุดท้ายก่อนสอบและ Workshop การเขียน IA สำหรับนักเรียน IB Year 13",
        hours: "24 Hours",
        start: "Starts Mar 10",
        badge: "Open for Enrollment",
        img: "https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&q=80&w=1200",
      },
    ],

    filteredCourses() {
      if (this.courseFilter === "all") return this.courses;
      return this.courses.filter((x) => x.type === this.courseFilter);
    },

    init() {
      initScrollAnimations();
    },
  };
}

/**
 * On-scroll animations using IntersectionObserver.
 * Adds `.in-view` to elements with `data-animate`.
 */
function initScrollAnimations() {
  const els = document.querySelectorAll("[data-animate]");
  if (!els.length) return;

  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("in-view"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
  );

  els.forEach((el) => io.observe(el));
}

async function loadLatestBlogPosts({
  apiBase = "https://intsightedu.com/wp-json/wp/v2",
  perPage = 3,
  containerId = "blogGrid",
  statusId = "blogStatus",
} = {}) {
  const grid = document.getElementById(containerId);
  const status = document.getElementById(statusId);

  if (!grid) return;

  const setStatus = (msg) => {
    if (status) status.textContent = msg || "";
  };

  setStatus("กำลังโหลดบทความล่าสุด...");

  // Use _embed to access featured image in a single request
  const url = `${apiBase}/posts?per_page=${perPage}&_embed=1`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      throw new Error(`WP API error: ${res.status} ${res.statusText}`);
    }

    const posts = await res.json();

    if (!Array.isArray(posts) || posts.length === 0) {
      grid.innerHTML = "";
      setStatus("ยังไม่มีบทความในขณะนี้");
      return;
    }

    const stripHtml = (html) =>
      (html || "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const formatDateTH = (iso) => {
      try {
        const d = new Date(iso);
        return d.toLocaleDateString("th-TH", {
          year: "numeric",
          month: "long",
          day: "2-digit",
        });
      } catch {
        return "";
      }
    };

    const getFeaturedImage = (post) => {
      // WordPress embeds featured media at: _embedded["wp:featuredmedia"][0]
      const media = post?._embedded?.["wp:featuredmedia"]?.[0];
      // Choose a reasonably sized image if available
      return (
        media?.media_details?.sizes?.medium_large?.source_url ||
        media?.media_details?.sizes?.large?.source_url ||
        media?.source_url ||
        null
      );
    };

    const getCategoryLabel = (post) => {
      // Categories may appear in _embedded["wp:term"] (index varies)
      const termGroups = post?._embedded?.["wp:term"];
      if (!Array.isArray(termGroups)) return "Blog";
      const categories = termGroups.flat().filter((t) => t?.taxonomy === "category");
      return categories?.[0]?.name || "Blog";
    };

    const cardHtml = posts.map((p) => {
      const title = stripHtml(p?.title?.rendered);
      const excerpt = stripHtml(p?.excerpt?.rendered);
      const link = p?.link || "https://intsightedu.com/blog";
      const date = formatDateTH(p?.date);
      const cat = getCategoryLabel(p);
      const img = getFeaturedImage(p);

      const safeExcerpt = excerpt || "อ่านบทความเพื่อดูรายละเอียดเพิ่มเติม...";
      const imageBlock = img
        ? `<div class="rounded-[16px] overflow-hidden aspect-[16/10]">
             <img src="${img}" class="w-full h-full object-cover hover:scale-105 transition duration-700" alt="${title}">
           </div>`
        : `<div class="rounded-[16px] overflow-hidden aspect-[16/10] bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
             ไม่มีรูปภาพ
           </div>`;

      return `
        <article class="card p-4">
          ${imageBlock}
          <div class="p-2 mt-5 space-y-3">
            <div class="text-xs text-slate-400 font-semibold">${date} • ${cat}</div>
            <h3 class="text-xl font-extrabold leading-tight hover:text-[color:var(--navy)] transition">
              ${title}
            </h3>
            <p class="text-sm text-slate-500 line-clamp-2">${safeExcerpt}</p>
            <a href="${link}" target="_blank" rel="noopener noreferrer" class="text-sm font-extrabold text-[color:var(--navy)]">
              อ่านต่อ →
            </a>
          </div>
        </article>
      `;
    }).join("");

    grid.innerHTML = cardHtml;
    setStatus("");
  } catch (err) {
    console.error(err);
    grid.innerHTML = "";
    setStatus("โหลดบทความไม่สำเร็จ (อาจติด CORS หรือ API ถูกปิด) — กรุณาลองใหม่อีกครั้ง");
  }
}

// Call after DOM loaded
document.addEventListener("DOMContentLoaded", () => {
  loadLatestBlogPosts({ perPage: 3 });
});

// Success Stories Renderer
function renderSuccessStories({
  containerId = "successGrid",
  stories = [],
} = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  el.innerHTML = stories.map((st, idx) => {
    const name = escapeHtml(st.name);
    const course = escapeHtml(st.course);
    const highlightLabel = escapeHtml(st.highlightLabel || "Success");
    const highlightValue = escapeHtml(st.highlightValue || "");
    const quote = escapeHtml(st.quote || "");
    const photo = escapeHtml(st.photo);
    const tag = escapeHtml(st.tag || "Outcome");

    return `
      <article class="story-card" style="--d:${idx * 120}ms">
        <div class="story-photo">
          <img src="${photo}" alt="${name}" loading="lazy" />
          <div class="story-highlight" aria-label="${highlightLabel}: ${highlightValue}">
            <span class="label">${highlightLabel}</span>
            <span class="value">${highlightValue}</span>
          </div>
        </div>

        <div class="story-body">
          <div class="story-name">${name}</div>

          <div class="story-meta">
            <span class="story-chip">${course}</span>
            <span class="text-slate-400">•</span>
            <span class="text-slate-500">${tag}</span>
          </div>

          ${quote ? `<p class="story-quote">“${quote}”</p>` : ""}

        </div>
      </article>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  renderSuccessStories({
    stories: [
      {
        name: "น้องพี (ม.5)",
        course: "SAT Digital",
        tag: "Score Improvement",
        highlightLabel: "SAT Score",
        highlightValue: "700+ (↑120)",
        quote: "ครูช่วยวางแผนอ่าน + ทำโจทย์รายสัปดาห์ ทำให้ทำเวลาได้ดีขึ้น",
        photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=1200",
      },
      {
        name: "น้องเอ (ม.6)",
        course: "Admissions Strategy",
        tag: "Admission Result",
        highlightLabel: "Admitted",
        highlightValue: "BBA • Chulalongkorn (Inter)",
        quote: "ช่วยวาง Portfolio และซ้อมสัมภาษณ์แบบเข้ม ทำให้มั่นใจขึ้นมาก",
        photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=1200",
      },
      {
        name: "น้องม.6 (Private)",
        course: "IELTS Academic",
        tag: "Band Achievement",
        highlightLabel: "IELTS Band",
        highlightValue: "7.5",
        quote: "Writing มีโครงสร้างชัด ตรวจละเอียด ทำให้คะแนนนิ่งและมั่นใจ",
        photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=1200",
      },
    ],
  });
});


(function initScrollAnimations() {
  const els = document.querySelectorAll("[data-animate]");
  if (!els.length) return;

  if (!("IntersectionObserver" in window)) {
    els.forEach(el => el.classList.add("in-view"));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });

  els.forEach(el => io.observe(el));
})();
