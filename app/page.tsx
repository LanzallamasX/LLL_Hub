"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/components/ui/button";
import Header from "@/app/component/Header/Header";
import Hero from "@/app/component/Hero/Hero";
import Footer from "./component/Footer/Footer";

// PARALLAX SLIDES (stack tipo Apple / Framer)

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {

      const slides = gsap.utils.toArray<HTMLElement>(".slide");

      slides.forEach((slide, i) => {
        if (i === slides.length - 1) return;

        gsap.to(slide, {
          scrollTrigger: {
            trigger: slide,
            start: "top top",
            end: "+=100%",
            scrub: true,
            pin: true,
            pinSpacing: false,
          },
          scale: 0.7,
          opacity: 0,
        });
      });

      // Animación de contenido interno
      gsap.utils.toArray<HTMLElement>(".slide-content").forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 60,
          duration: 0.8,
          scrollTrigger: {
            trigger: el,
            start: "top 50%",
          },
        });
      });

    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <>
    <div ref={containerRef} className="bg-[#0b0f1a] text-white">

      {/* HERO */}
      <Header />
      <Hero />

      {/* SLIDES PARALLAX */}
      {[{
        title: "Creás una solicitud",
        desc: "Seleccionás fechas y enviás en segundos.",
        img: "/images/notebook_solicitud.png",
      },
      {
        title: "Se procesa automáticamente",
        desc: "La solicitud entra en flujo y se revisa.",
        img: "/images/notebook.png",
      },
      {
        title: "Recibís una respuesta",
        desc: "Se aprueba o rechaza y se actualiza tu balance.",
        img: "/images/notebook-aprobado.png",
      },
      {
        title: "Todo queda registrado",
        desc: "Podés ver historial en cualquier momento.",
        img: "/images/balances.png",
      }].map((step, i) => (

        <section
          key={i}
          className="slide min-h-screen flex items-center justify-center px-6"
        >

          <div className="slide-content container w-full grid md:grid-cols-2 gap-16 items-center">

            {/* IMAGE */}
            <div className="relative">
              <img
                src={step.img}
                className="rounded-2xl "
              />
            </div>

            {/* TEXT */}
            <div className="space-y-4">
              <div className="text-orange-400 text-sm">
                Paso {i + 1}
              </div>
              <h3 className="text-3xl font-semibold">
                {step.title}
              </h3>
              <p className="text-slate-400 max-w-md">
                {step.desc}
              </p>
            </div>

          </div>

        </section>

      ))}



    </div>
    <Footer />
    </>
  );
}
