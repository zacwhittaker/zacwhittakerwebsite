const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

const header = document.querySelector(".site-header");
let lastScrollY = window.scrollY;
let scrollTicking = false;

const updateHeader = () => {
  const currentScrollY = Math.max(window.scrollY, 0);
  const hasMoved = Math.abs(currentScrollY - lastScrollY) > 6;

  header?.classList.toggle("is-scrolled", currentScrollY > 24);

  if (hasMoved && currentScrollY > 100) {
    header?.classList.toggle("is-hidden", currentScrollY > lastScrollY);
    lastScrollY = currentScrollY;
  } else if (currentScrollY <= 100) {
    header?.classList.remove("is-hidden");
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
