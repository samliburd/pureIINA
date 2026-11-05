import { VideoCodec } from "./types";

export const REGEX_WHITESPACE = /\s/g;
export const DEFAULT_START_TIME = "00:00:00.000";
export const VIDEO_EXTENSIONS =
  /[-\w\s\.]+\.(mp4|webm|mkv|avi|m4v|mov|flv|ogv|3gp|wmv|mts|m2ts|ts)/gim;

export interface CodecOptionConfig {
  encoder: string;
  qualityFlag: "-crf" | "-q:v";
  qualityValue: number;
  preset?: string;
  tag?: string;
}

export const DEFAULT_CODEC: VideoCodec = "x264";

export const CODEC_CONFIGS: Record<VideoCodec, CodecOptionConfig> = {
  x264: {
    encoder: "libx264",
    qualityFlag: "-crf",
    qualityValue: 17,
    preset: "fast",
  },
  x265: {
    encoder: "libx265",
    qualityFlag: "-crf",
    qualityValue: 22,
    preset: "fast",
    tag: "hvc1",
  },
  h264_videotoolbox: {
    encoder: "h264_videotoolbox",
    qualityFlag: "-q:v",
    qualityValue: 75,
  },
  hevc_videotoolbox: {
    encoder: "hevc_videotoolbox",
    qualityFlag: "-q:v",
    qualityValue: 75,
    tag: "hvc1",
  },
};

export const FFMPEG_DEFAULTS = {
  codec: "libx264",
  crf: 17,
  preset: "fast",
  audioCodec: "aac",
  container: "mp4",
};
