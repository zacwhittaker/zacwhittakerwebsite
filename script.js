const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

const header = document.querySelector(".site-header");
const hero = document.querySelector(".hero");
let lastScrollY = window.scrollY;
let scrollTicking = false;

const updateHeader = () => {
  const currentScrollY = Math.max(window.scrollY, 0);
  const hasMoved = Math.abs(currentScrollY - lastScrollY) > 6;
  const landingEnd = hero
    ? hero.offsetTop + hero.offsetHeight - (header?.offsetHeight ?? 0)
    : 600;
  const isPastLanding = currentScrollY > landingEnd;

  header?.classList.toggle("is-scrolled", isPastLanding);

  if (!isPastLanding) {
    header?.classList.remove("is-hidden");
    lastScrollY = currentScrollY;
  } else if (hasMoved) {
    header?.classList.toggle("is-hidden", currentScrollY > lastScrollY);
    lastScrollY = currentScrollY;
  }

  scrollTicking = false;
};

window.addEventListener(
  "scroll",
  () => {
    if (!scrollTicking) {
      window.requestAnimationFrame(updateHeader);
      scrollTicking = true;
    }
  },
  { passive: true }
);

window.addEventListener("resize", updateHeader);
updateHeader();

const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.querySelector(".mobile-menu");

const closeMobileMenu = () => {
  menuToggle?.setAttribute("aria-expanded", "false");
  menuToggle?.setAttribute("aria-label", "Open navigation");
  document.body.classList.remove("menu-open");
};

menuToggle?.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  document.body.classList.toggle("menu-open", !isOpen);
});

mobileMenu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMobileMenu));
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMobileMenu();
});
window.addEventListener("resize", () => {
  if (window.innerWidth > 800) closeMobileMenu();
});

const revealTargets = document.querySelectorAll(
  ".section-intro, .work-list, .about-grid"
);
if ("IntersectionObserver" in window) {
  revealTargets.forEach((target) => target.classList.add("reveal"));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealTargets.forEach((target) => observer.observe(target));
}
