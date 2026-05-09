import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL ou Anon Key não configurados no arquivo .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Faz upload de um arquivo para o Supabase Storage
 * @param {File} file O arquivo a ser enviado
 * @param {string} bucket O nome do bucket (ex: 'photos')
 * @param {string} path O caminho dentro do bucket
 * @returns {Promise<string>} A URL pública do arquivo
 */
export const uploadToSupabase = async (file, bucket, path) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Erro no upload para Supabase:', error);
    throw error;
  }
};
