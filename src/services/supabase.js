import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _client = null;

export function getSupabase() {
  if (_client) return _client;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL ou Anon Key não configurados no arquivo .env (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY). Upload de arquivos ficará desabilitado.');
    return null;
  }
  _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

export const supabase = getSupabase();

/**
 * Faz upload de um arquivo para o Supabase Storage
 * @param {File} file O arquivo a ser enviado
 * @param {string} bucket O nome do bucket (ex: 'bellizyuplo')
 * @param {string} path O caminho dentro do bucket
 * @returns {Promise<string>} A URL pública do arquivo
 */
export const uploadToSupabase = async (file, bucket, path) => {
  try {
    const client = getSupabase();
    if (!client) {
      throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.');
    }
    const targetBucket = bucket.trim();

    const { data, error } = await client.storage
      .from(targetBucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      });

    if (error) {
      const { data: buckets } = await client.storage.listBuckets();
      console.error('Buckets encontrados no seu projeto:', buckets?.map(b => b.name));
      throw error;
    }

    const { data: { publicUrl } } = client.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Erro no upload para Supabase:', error);
    throw error;
  }
};
