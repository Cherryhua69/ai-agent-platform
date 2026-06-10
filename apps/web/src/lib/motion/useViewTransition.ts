import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function useViewTransition(activeView: string) {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          allowMotion: "(prefers-reduced-motion: no-preference)"
        },
        (context) => {
          if (context.conditions?.reduceMotion) {
            gsap.set(".reveal-item", { clearProps: "all" });
            return;
          }

          gsap.fromTo(
            ".view-page",
            { y: 10, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.26, ease: "power2.out", overwrite: "auto" }
          );

          gsap.fromTo(
            ".reveal-item",
            { y: 8, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: 0.3,
              ease: "power2.out",
              stagger: 0.025,
              overwrite: "auto"
            }
          );
        },
        scope
      );

      return () => mm.revert();
    },
    { dependencies: [activeView], scope }
  );

  return scope;
}
