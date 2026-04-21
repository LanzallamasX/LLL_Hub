import styles from "./Button.module.css";

type Props = {
  children: React.ReactNode;
};

export default function Button({ children }: Props) {
  return (
    <button className={styles.cta}>
      {children}
    </button>
  );
}