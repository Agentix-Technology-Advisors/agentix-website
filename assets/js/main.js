document.documentElement.classList.add("js");

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
	navToggle.addEventListener("click", () => {
		const isOpen = navToggle.getAttribute("aria-expanded") === "true";
		navToggle.setAttribute("aria-expanded", String(!isOpen));
		siteNav.classList.toggle("is-open", !isOpen);
		document.body.classList.toggle("nav-open", !isOpen);
	});

	siteNav.querySelectorAll("a").forEach((link) => {
		link.addEventListener("click", () => {
			navToggle.setAttribute("aria-expanded", "false");
			siteNav.classList.remove("is-open");
			document.body.classList.remove("nav-open");
		});
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
      threshold: 0.2
    }
  );

	document.querySelectorAll(".reveal-up").forEach((element) => {
		observer.observe(element);
	});
} else {
	document.querySelectorAll(".reveal-up").forEach((element) => {
		element.classList.add("is-visible");
	});
}