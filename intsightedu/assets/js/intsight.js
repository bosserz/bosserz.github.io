/* assets/js/intsight.js */

/**
 * Alpine component for homepage state (menu + course filter + course data)
 * Keeps HTML clean while staying lightweight.
 */
function intsightHome() {
  return {
    mobileMenu: false,
    courseFilter: "all",
    courses: [],
    coursesLoaded: false,

    async init() {
      await this.loadCourses();
      initScrollAnimations();
    },

    async loadCourses() {
      const courseFiles = [
        'courses/sat-math.html',
        'courses/ged.html',
        'courses/ielts.html',
        'courses/igcse.html',
        'courses/sat-math-turbo.html',
        'courses/cu-ats.html'
      ];

      const courses = [];
      
      for (const file of courseFiles) {
        try {
          const response = await fetch(file);
          if (!response.ok) continue;
          
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const metadataScript = doc.getElementById('course-metadata');
          
          if (metadataScript) {
            const metadata = JSON.parse(metadataScript.textContent);
            courses.push(metadata);
          }
        } catch (error) {
          console.error(`Failed to load course from ${file}:`, error);
        }
      }

      this.courses = courses;
      this.coursesLoaded = true;
    },

    filteredCourses() {
      if (this.courseFilter === "all") return this.courses;
      return this.courses.filter((x) => x.type === this.courseFilter);
    }
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

// Team Members Renderer
function renderTeamMembers({
  containerId = "teamGrid",
  members = [],
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

  el.innerHTML = members.map((member, idx) => {
    const name = escapeHtml(member.name);
    const role = escapeHtml(member.role);
    const education = escapeHtml(member.education);
    const photo = escapeHtml(member.photo);

    return `
      <article class="team-card" style="--d:${idx * 80}ms">
        <div class="team-photo">
          <img src="${photo}" alt="${name}" loading="lazy" />
          <div class="team-role">
            <span class="chip bg-white/15 text-white border border-white/20">${role}</span>
          </div>
        </div>
        <div class="team-info">
          <div class="team-name">${name}</div>
          <div class="team-education">${education}</div>
        </div>
      </article>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  renderSuccessStories({
    stories: [
      {
        name: "น้องแบม",
        course: "GED",
        tag: "High Score",
        highlightLabel: "GED Total Score",
        highlightValue: "641",
        quote: "ครูอ้นช่วยวางแผนการเรียนและติวเข้ม ทำให้สอบผ่านด้วยคะแนนสูงกว่าที่ตั้งเป้าไว้มาก",
        photo: "https://storage.googleapis.com/intsight-assets/web-assets/success-stories/nong_bam_ged.jpg",
      },
      {
        name: "น้องเฟิร์ส",
        course: "GED",
        tag: "1 time pass",
        highlightLabel: "Pass!",
        highlightValue: "ผ่านทุกวิชาในการสอบครั้งเดียว",
        quote: "พี่ๆ Intsight สอนดีมากค่ะ เข้าใจง่าย ทำให้สอบผ่านทุกวิชาได้ในครั้งเดียวเลย",
        photo: "https://storage.googleapis.com/intsight-assets/web-assets/success-stories/nong_first_ged.jpg",
      },
      {
        name: "น้องนน",
        course: "Admission Prep",
        tag: "วางแผนการเรียนทุกวิชา",
        highlightLabel: "IELTS Band",
        highlightValue: "7.0",
        quote: "เรียนกับพี่อ้นทุกวิชา พี่ๆ ช่วยวางแผนการเรียนและติวเข้ม ทำให้สอบติดคณะที่ต้องการได้สำเร็จ",
        photo: "https://storage.googleapis.com/intsight-assets/web-assets/success-stories/nong_non_ged.jpg",
      },
      {
        name: "น้องแบม",
        course: "GED",
        tag: "High Score",
        highlightLabel: "GED Total Score",
        highlightValue: "641",
        quote: "ครูอ้นช่วยวางแผนการเรียนและติวเข้ม ทำให้สอบผ่านด้วยคะแนนสูงกว่าที่ตั้งเป้าไว้มาก",
        photo: "https://storage.googleapis.com/intsight-assets/web-assets/success-stories/nong_bam_ged.jpg",
      },
      {
        name: "น้องเฟิร์ส",
        course: "GED",
        tag: "1 time pass",
        highlightLabel: "Pass!",
        highlightValue: "ผ่านทุกวิชาในการสอบครั้งเดียว",
        quote: "พี่ๆ Intsight สอนดีมากค่ะ เข้าใจง่าย ทำให้สอบผ่านทุกวิชาได้ในครั้งเดียวเลย",
        photo: "https://storage.googleapis.com/intsight-assets/web-assets/success-stories/nong_first_ged.jpg",
      },
      {
        name: "น้องนน",
        course: "Admission Prep",
        tag: "วางแผนการเรียนทุกวิชา",
        highlightLabel: "IELTS Band",
        highlightValue: "7.0",
        quote: "เรียนกับพี่อ้นทุกวิชา พี่ๆ ช่วยวางแผนการเรียนและติวเข้ม ทำให้สอบติดคณะที่ต้องการได้สำเร็จ",
        photo: "https://storage.googleapis.com/intsight-assets/web-assets/success-stories/nong_non_ged.jpg",
      },
    ],
  });

  renderTeamMembers({
    members: [
      {
        name: "Kru Aon",
        role: "Lead Academic Advisor",
        education: "MS, Chulalongkorn",
        photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=900",
      },
      {
        name: "Kru Boss",
        role: "Senior Math Mentor",
        education: "MSc, Georgia Tech",
        photo: "https://intsightedu.com/wp-content/uploads/2023/10/k-boss.png",
      },
      {
        name: "ครูเง็ก",
        role: "IGCSE & Business Mentor",
        education: "Msc, Warwick",
        photo: "https://intsightedu.com/wp-content/uploads/2023/10/k-name.jpeg",
      },
      {
        name: "Kru Nicky",
        role: "English Mentor",
        education: "MS, Where",
        photo: "https://intsightedu.com/wp-content/uploads/2023/10/k-nicky.jpg",
      },
      {
        name: "ครูนัท",
        role: "Physics Mentor",
        education: "BEng. Chulalongkorn",
        photo: "https://intsightedu.com/wp-content/uploads/2023/10/k-nut.jpg",
      },
      {
        name: "ครูดาด้า",
        role: "Chemistry Mentor",
        education: "BSc, Thammasat",
        photo: "https://intsightedu.com/wp-content/uploads/2023/10/k-dada.jpg",
      },
      {
        name: "ครูสุ",
        role: "Biology Mentor",
        education: "University of Canberra",
        photo: "https://intsightedu.com/wp-content/uploads/2023/10/k-sue.jpg",
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
