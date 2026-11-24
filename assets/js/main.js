document.documentElement.classList.add("js");

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  const closeNav = () => {
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open navigation");
    siteNav.classList.remove("is-open");
    document.body.classList.remove("nav-open");
  };

  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
    siteNav.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("nav-open", !isOpen);
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      closeNav();
    });
  });

  const desktopNav = window.matchMedia("(min-width: 1101px)");
  desktopNav.addEventListener("change", (event) => {
    if (event.matches) closeNav();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && siteNav.classList.contains("is-open")) {
      closeNav();
      navToggle.focus();
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (!siteNav.classList.contains("is-open")) {
      return;
    }

    const clickedInsideNav = siteNav.contains(target);
    const clickedToggle = navToggle.contains(target);
    if (!clickedInsideNav && !clickedToggle) {
      closeNav();
    }
  });
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.2,
    },
  );

  document.querySelectorAll(".reveal-up").forEach((element) => {
    observer.observe(element);
  });
} else {
  document.querySelectorAll(".reveal-up").forEach((element) => {
    element.classList.add("is-visible");
  });
}

const heroBooking = document.querySelector(".hero-actions .button--booking");
const headerBooking = document.querySelector(".header-booking");

if (heroBooking && headerBooking) {
  const header = headerBooking.closest("header");
  const closingBooking = document.querySelector("#cta .button--booking");
  let frame = 0;

  function syncBooking() {
    frame = 0;
    const top = header.getBoundingClientRect().bottom;
    const closing = closingBooking?.getBoundingClientRect();
    const closingVisible = closing && closing.top < window.innerHeight && closing.bottom > top;
    const show = heroBooking.getBoundingClientRect().bottom <= top && !closingVisible;
    headerBooking.toggleAttribute("data-visible", show || document.activeElement === headerBooking);
  }

  function scheduleBooking() {
    if (!frame) frame = requestAnimationFrame(syncBooking);
  }

  window.addEventListener("scroll", scheduleBooking, { passive: true });
  window.addEventListener("resize", scheduleBooking);
  window.addEventListener("pageshow", scheduleBooking);
  headerBooking.addEventListener("blur", scheduleBooking);
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(scheduleBooking);
    observer.observe(header);
    observer.observe(document.body);
  }
  syncBooking();
}
