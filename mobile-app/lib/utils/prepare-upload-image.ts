import * as ImageManipulator from 'expo-image-manipulator';

export type MobileImageUploadKind = 'complaint' | 'kyc' | 'avatar';

type PrepareOptions = {
  uri: string;
  width?: number;
  height?: number;
  kind: MobileImageUploadKind;
  /** When true, resize to a square cover (avatar). */
  square?: boolean;
};

export type PreparedUploadImage = {
  uri: string;
  name: string;
  type: string;
};

const PRESETS: Record<
  MobileImageUploadKind,
  { maxLongEdge: number; quality: number; squareSize?: number }
> = {
  complaint: { maxLongEdge: 1920, quality: 0.82 },
  kyc: { maxLongEdge: 2560, quality: 0.9 },
  avatar: { maxLongEdge: 512, quality: 0.85, squareSize: 512 },
};

/**
 * Resize and compress a local image URI before multipart upload.
 * Falls back to the original URI if manipulation fails.
 */
export async function prepareImageForUpload(
  options: PrepareOptions,
): Promise<PreparedUploadImage> {
  const preset = PRESETS[options.kind];
  const actions: ImageManipulator.Action[] = [];

  const w = options.width ?? 0;
  const h = options.height ?? 0;

  if (options.square && preset.squareSize) {
    const size = preset.squareSize;
    actions.push({ resize: { width: size, height: size } });
  } else if (w > 0 && h > 0) {
    const long = Math.max(w, h);
    if (long > preset.maxLongEdge) {
      const scale = preset.maxLongEdge / long;
      actions.push({
        resize: {
          width: Math.max(1, Math.round(w * scale)),
          height: Math.max(1, Math.round(h * scale)),
        },
      });
    }
  } else {
    actions.push({ resize: { width: preset.maxLongEdge } });
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      options.uri,
      actions.length ? actions : [],
      {
        compress: preset.quality,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    const name =
      options.kind === 'kyc'
        ? `kyc-${Date.now()}.jpg`
        : options.kind === 'avatar'
          ? `avatar-${Date.now()}.jpg`
          : `photo-${Date.now()}.jpg`;

    return {
      uri: result.uri,
      name,
      type: 'image/jpeg',
    };
  } catch {
    return {
      uri: options.uri,
      name: `image-${Date.now()}.jpg`,
      type: 'image/jpeg',
    };
  }
}

/** Prepare multiple complaint/proof photos. */
export async function prepareImagesForUpload(
  assets: { uri: string; width?: number; height?: number }[],
  kind: Exclude<MobileImageUploadKind, 'avatar'>,
): Promise<PreparedUploadImage[]> {
  const results: PreparedUploadImage[] = [];
  for (const asset of assets) {
    results.push(
      await prepareImageForUpload({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        kind,
      }),
    );
  }
  return results;
}
