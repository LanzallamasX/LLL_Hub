import { supabase } from "@/lib/supabase/client";

export async function uploadPrescription(file: File): Promise<string> {
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const extension = extensions[file.type];
  if (!extension || file.size > 10 * 1024 * 1024 || file.size === 0) {
    throw new Error("Elegí una foto JPG, PNG o WebP de hasta 10 MB.");
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Iniciá sesión para adjuntar la prescripción.");
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("medical-prescriptions").upload(path, file);
  if (error) throw error;
  return path;
}

export async function getPrescriptionUrl(path: string) {
  const { data, error } = await supabase.storage.from("medical-prescriptions").createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function openPrescription(path: string) {
  window.open(await getPrescriptionUrl(path), "_blank", "noopener,noreferrer");
}
