import styles from "./Hero.module.css";
import { Button } from "@/components/ui/button";

export default function Hero() {
  return (
    <section className={styles.hero}>

      <div className={styles.frame}> 

        <div className={styles.content}>
          <h1 className={styles.title}>
            Gestioná tu tiempo, sin fricción
          </h1>

          <p >
            Pedí vacaciones, registrá ausencias y seguí todo en un solo lugar.
          </p>

          <Button>Iniciar sesión</Button>

        </div>

      </div>

    </section>
  );
}