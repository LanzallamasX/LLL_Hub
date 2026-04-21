"use client";

import styles from "./Footer.module.css";
import Link from "next/link";


export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>


        <div className="flex justify-center items-center space-around gap-24">
            {/* LEFT */}
            <div className={styles.left}>
            <img src="/images/logo.svg" alt="Noova Logo" />
            </div>

            {/* 
            <nav className={styles.nav}>
            <Link href="#">Home</Link>
            <Link href="#">Servicios</Link>
            <Link href="#">Portfolio</Link>
            <Link href="#">Contacto</Link>
            </nav>
             */}
        </div>

        {/* 
        <div className={styles.social}>
         
          <a href="#"><WspIcon /></a>
          <a href="#"><IgIcon /></a>
          <a href="#"><InIcon /></a>
          
        </div>

         */}

      </div>
    </footer>
  );
}