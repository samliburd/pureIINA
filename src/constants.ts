export const REGEX_WHITESPACE = /\s/g;
export const DEFAULT_START_TIME = "00:00:00.000";
export const VIDEO_EXTENSIONS =
  /[-\w\s\.]+\.(mp4|webm|mkv|avi|m4v|mov|flv|ogv|3gp|wmv|mts|m2ts|ts)/gim;

export const FFMPEG_DEFAULTS = {
  codec: "libx264",
  crf: 17,
  preset: "fast",
  audioCodec: "aac",
  container: "mp4",
};
