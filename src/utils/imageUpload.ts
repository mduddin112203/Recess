import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';

export async function uploadImage(
  bucket: string,
  remotePath: string,
  fileUri: string
): Promise<string | null> {
  try {
    const base64 = await readAsStringAsync(fileUri, {
      encoding: EncodingType.Base64,
    });

    const { error } = await supabase.storage
      .from(bucket)
      .upload(remotePath, decode(base64), {
        upsert: true,
        contentType: 'image/jpeg',
      });

    if (error) {
      console.error(`Upload to ${bucket}/${remotePath} failed:`, error.message);
      return null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(remotePath);
    return data.publicUrl;
  } catch (e) {
    console.error(`Upload to ${bucket}/${remotePath} exception:`, e);
    return null;
  }
}
