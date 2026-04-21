"use client";

import { useState } from "react";
import styles from "./Header.module.css";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Header() {
  const [open, setOpen] = useState(false);

  const router = useRouter();

  return (
    <>
      <header className={styles.wrapper}>
        <div className={styles.nav}>

          {/* Logo */}
          <div className={styles.logo}>
            <img src="/images/logo.svg" alt="Lanzallamas Logo" />
          </div>

          {/* Desktop */}
          
          <div className={styles.desktop}>
            {/*
            <nav className={styles.links}>
              <a href="#">Servicios</a>
              <a href="#">Portfolio</a>
              <a href="#">Nosotros</a>
            </nav>
            */}

            <Button onClick={() => router.push("/login")}>
              Iniciar sesión
            </Button>
          </div>

          {/* Mobile hamburger */}
          <div className={styles.mobileToggle} onClick={() => setOpen(true)}>
            ☰
          </div>

        </div>
      </header>

      {/* Mobile Menu */}
      {open && (
        <div className={styles.mobileMenu}>
          
          <div className={styles.mobileHeader}>
            <img src="/images/logo_noova_light.svg" alt="" />
            <button onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className={styles.mobileLinks}>
            <a>Soluciones</a>
            <a>Servicios de marketing</a>
            <a>Servicios tecnológicos</a>
            <a>Nuestro trabajo</a>
            <a>Sobre nosotros</a>
            <a>Contacto</a>
          </div>

        </div>
      )}
    </>
  );
}