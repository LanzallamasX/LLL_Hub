import styles from "./Hero.module.css";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Hero() {
  const router = useRouter();


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

          <Button onClick={() => router.push("/login")}>Iniciar sesión</Button>

        </div>

      </div>

    </section>
  );
}