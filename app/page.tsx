"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/components/ui/button";

// MIX: minimal + visual + steps con imágenes

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-el", {
        opacity: 0,
        y: 60,
        duration: 0.9,
        stagger: 0.15,
        ease: "power3.out",
      });

      gsap.from(".step", {
        scrollTrigger: {
          trigger: stepsRef.current,
          start: "top 80%",
        },
        opacity: 0,
        y: 60,
        duration: 0.8,
        stagger: 0.2,
      });

      gsap.to(".floating", {
        y: -10,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-12 items-center">

        <div className="space-y-6">
          <h1 className="hero-el text-5xl font-bold leading-tight">
            Gestioná ausencias
            <br />
            <span className="text-orange-400">sin fricción</span>
          </h1>

          <p className="hero-el text-slate-400 max-w-md">
            Vacaciones, solicitudes y aprobaciones en un solo lugar.
            Simple, claro y sin depender de mails o planillas.
          </p>

          <div className="hero-el">
            <Button className="bg-orange-500 hover:bg-orange-600 px-8 py-3 text-lg rounded-xl">
              Iniciar sesión
            </Button>
          </div>
        </div>

        {/* IMAGE + FLOAT */}
        <div className="hero-el relative">
          <img
            src="/images/hero-dashboard.png"
            className="rounded-2xl border border-slate-800 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          />

          <div className="floating absolute -bottom-6 -left-6 bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl text-sm">
            <p className="text-slate-400">Solicitud</p>
            <p className="text-white">Vacaciones</p>
            <p className="text-xs text-slate-500">01/01 → 07/01</p>
          </div>

          <div className="floating absolute top-6 -right-6 bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl text-sm">
            <p className="text-slate-400">Estado</p>
            <p className="text-emerald-400">Aprobado</p>
          </div>
        </div>

      </section>

      {/* FLOW */}
      <section ref={stepsRef} className="max-w-6xl mx-auto px-6 pb-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold">¿Cómo funciona?</h2>
          <p className="text-slate-400 mt-2">
            Un proceso simple en 3 pasos
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-10">

          {[{
            title: "Creás la solicitud",
            desc: "Seleccionás fechas y enviás en segundos.",
            img: "/images/step1.png",
          },
          {
            title: "Se procesa",
            desc: "La solicitud se revisa dentro del sistema.",
            img: "/images/step2.png",
          },
          {
            title: "Recibís respuesta",
            desc: "Se aprueba o rechaza y se actualiza tu balance.",
            img: "/images/step3.png",
          }].map((step, i) => (
            <div key={i} className="step space-y-4">

              <div className="relative">
                <img
                  src={step.img}
                  className="rounded-xl border border-slate-800 shadow-lg"
                />

                <div className="absolute top-3 left-3 text-xs bg-black/60 backdrop-blur px-2 py-1 rounded">
                  0{i + 1}
                </div>
              </div>

              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-sm text-slate-400">{step.desc}</p>

            </div>
          ))}

        </div>
      </section>

      {/* CTA */}
      <section className="text-center pb-20">
        <p className="text-slate-400 mb-6">
          Accedé para empezar a gestionar tus solicitudes
        </p>
        <Button className="bg-orange-500 hover:bg-orange-600 px-10 py-3 text-lg rounded-xl">
          Ir a login
        </Button>
      </section>

    </div>
  );
}
