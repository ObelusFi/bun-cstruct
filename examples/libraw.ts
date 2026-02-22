import { CString, dlopen, type FFIFunction, type Library, type Pointer, read } from "bun:ffi"
import { chars, CStruct, f32, u16, i32, u32, array, struct, u8, u64, i16, string } from '../index';
import { endianness } from "node:os";

const PTR_SIZE = 8;

export class Iparams extends CStruct {
  @chars(4) guard!: string;
  @chars(64) make!: string;
  @chars(64) model!: string;
  @chars(64) software!: string;
  @chars(64) normalized_make!: string;
  @chars(64) normalized_model!: string;
  @u32 maker_index!: number;
  @u32 raw_count!: number;
  @u32 dng_version!: number;
  @u32 is_foveon!: number;
  @i32 colors!: number;
  @u32 filters!: number;
  @array(chars(6), 6) xtrans!: string[];
  @array(chars(6), 6) xtrans_abs!: string[];
  @chars(5) cdesc!: string;
  @u32 xmplen!: number;
  @string xmpdata!: string;
}

export class NikonLens extends CStruct {
  @f32 EffectiveMaxAp!: number;
  @u8 LensIDNumber!: number;
  @u8 LensFStops!: number;
  @u8 MCUVersion!: number;
  @u8 LensType!: number;
}


export class DngLens extends CStruct {
  @f32 MinFocal!: number;
  @f32 MaxFocal!: number;
  @f32 MaxAp4MinFocal!: number;
  @f32 MaxAp4MaxFocal!: number;
}


export class MakerNotesLens extends CStruct {
  @u64 LensID!: bigint;
  @chars(128) Lens!: string;
  @u16 LensFormat!: number;
  @u16 LensMount!: number;
  @u64 CamID!: bigint;
  @u16 CameraFormat!: number;
  @u16 CameraMount!: number;
  @chars(64) body!: string;
  @i16 FocalType!: number;
  @chars(16) LensFeatures_pre!: string;
  @chars(16) LensFeatures_suf!: string;

  @f32 MinFocal!: number;
  @f32 MaxFocal!: number;

  @f32 MaxAp4MinFocal!: number;
  @f32 MaxAp4MaxFocal!: number;
  @f32 MinAp4MinFocal!: number;
  @f32 MinAp4MaxFocal!: number;

  @f32 MaxAp!: number;
  @f32 MinAp!: number;

  @f32 CurFocal!: number;
  @f32 CurAp!: number;

  @f32 MaxAp4CurFocal!: number;
  @f32 MinAp4CurFocal!: number;

  @f32 MinFocusDistance!: number;
  @f32 FocusRangeIndex!: number;

  @f32 LensFStops!: number;

  @u64 TeleconverterID!: bigint;
  @chars(128) Teleconverter!: string;

  @u64 AdapterID!: bigint;
  @chars(128) Adapter!: string;

  @u64 AttachmentID!: bigint;
  @chars(128) Attachment!: string;

  @u16 FocalUnits!: number;
  @f32 FocalLengthIn35mmFormat!: number;
}

export class LensInfo extends CStruct {
  @f32 minFocal!: number;
  @f32 maxFocal!: number;
  @f32 maxApt4MinFocal!: number;
  @f32 maxApt4MaxFocal!: number;
  @f32 EXIFMaxAp!: number;
  @chars(128) lensMake!: string;
  @chars(128) lens!: string;
  @chars(128) lensSerial!: string;
  @chars(128) internalLensSerial!: string;
  @u16 focalLengthIn35mmFormat!: number;
  @struct(NikonLens) nikon!: NikonLens;
  @struct(DngLens) dng!: DngLens;
  @struct(MakerNotesLens) makernotes!: MakerNotesLens;
}

export class GpsInfo extends CStruct {
  @array(f32, 3) latitude!: number[]; /* Deg,min,sec */
  @array(f32, 3) longitude!: number[]; /* Deg,min,sec */
  @array(f32, 3) gpstimestamp!: number[]; /* Deg,min,sec */
  @f32 altitude!: number;
  @u8 altref!: number;
  @u8 latref!: number;
  @u8 longref!: number;
  @u8 gpsstatus!: number;
  @u8 gpsparsed!: number;
}

export class ImageOther extends CStruct {
  @f32 iso_speed!: number;
  @f32 shutter!: number;
  @f32 aperture!: number;
  @f32 focal_len!: number;
  @i32 timestamp!: number;
  @u32 shot_order!: number;
  @array(i32, 32) gps_data!: number[];
  @struct(GpsInfo) parsed_gps!: GpsInfo;
  @chars(512) desc!: string;
  @chars(64) artist!: string;
  @array(f32, 4) analogbalance!: number[];
}


/**
 * To read the data you have to
 * const i = lib.dcraw_make_mem_thumb()
 * const pi = ProcessedImage.pointerTo(i)
 * const buffer = toBuffer(pi, ProcessedImage.size, i.data_size);
 */

export class ProcessedImage extends CStruct {
  @u32 type!: number;
  @u16 height!: number;
  @u16 width!: number;
  @u16 colors!: number;
  @u16 bits!: number;
  @i32 data_size!: number;
  // the rest of the data is here
}

export class DecoderInfo extends CStruct {
  @string name!: string;
  @u32 decoder_flags!: number;
}


const ffiFuncs = {
  libraw_version: { returns: 'cstring' },
  libraw_init: { returns: "pointer" },
  libraw_open_file: { returns: "int", args: ["pointer", "cstring"] },
  libraw_get_iwidth: { returns: 'int', args: ["pointer"] },
  libraw_get_iheight: { returns: "int", args: ["pointer"] },
  libraw_get_iparams: { returns: "pointer", args: ["pointer"] },
  libraw_get_lensinfo: { returns: "pointer", args: ["pointer"] },
  libraw_close: { returns: "void", args: ["pointer"] },
  libraw_get_raw_width: { returns: "int", args: ["pointer"] },
  libraw_get_raw_height: { returns: "int", args: ["pointer"] },
  libraw_get_imgother: { returns: "pointer", args: ["pointer"] },
  libraw_dcraw_make_mem_image: { returns: "pointer", args: ["pointer", "pointer"] },
  libraw_dcraw_ppm_tiff_writer: { returns: "int", args: ["pointer", "cstring"] },
  libraw_unpack: { returns: 'int', args: ['pointer'] },
  libraw_dcraw_process: { returns: 'int', args: ['pointer'] },
  libraw_dcraw_thumb_writer: { returns: "int", args: ["pointer", "cstring"] },
  libraw_dcraw_make_mem_thumb: { returns: "pointer", args: ["pointer", "pointer"] },
  libraw_unpack_thumb: { returns: "int", args: ["pointer"] },
  libraw_strerror: { args: ['int'], returns: "cstring" },
  libraw_strprogress: { args: ['i32'], returns: "cstring" },
  libraw_open_buffer: { args: ['pointer', 'pointer', 'usize'], returns: 'int' },
  libraw_recycle: { args: ['pointer'] },
  libraw_recycle_datastream: { args: ['pointer'] },
  libraw_raw2image: { args: ['pointer'], returns: 'int' },
  libraw_free_image: { args: ['pointer'] },
  libraw_versionNumber: { returns: 'int' },
  libraw_cameraList: { returns: 'pointer' },
  libraw_cameraCount: { returns: "int" },
  libraw_capabilities: { returns: 'u32' },
  libraw_dcraw_clear_mem: { args: ["pointer"] },
  libraw_get_decoder_info: { args: ["pointer", "pointer"], returns: "int" },
  libraw_adjust_sizes_info_only: { args: ["pointer"], returns: "int" },
  libraw_COLOR: { args: ["pointer", "int", "int"], returns: "int" },
  libraw_subtract_black: { args: ["pointer"] },
  libraw_unpack_thumb_ex: { args: ["pointer", "int"], returns: "int" },
  libraw_open_bayer: { args: ["pointer", "pointer", "u32", "u16", "u16", "u16", "u16", "u16", "u16", "u8", "u8", "u32", "u32", "u32"] },
  libraw_unpack_function_name: { args: ["pointer"], returns: "cstring" },
  libraw_set_demosaic: { args: ["pointer", "int"] },
  libraw_set_output_color: { args: ["pointer", "int"] },
  libraw_set_adjust_maximum_thr: { args: ["pointer", "f32"] },
  libraw_set_user_mul: { args: ["pointer", "int", "f32"] },
  libraw_set_output_bps: { args: ["pointer", "f32"] },
  libraw_set_gamma: { args: ["pointer", "int", "f32"] },
  libraw_set_no_auto_bright: { args: ["pointer", "int"] },
  libraw_set_bright: { args: ["pointer", "float"] },
  libraw_set_highlight: { args: ["pointer", "int"] },
  libraw_set_fbdd_noiserd: { args: ["pointer", "int"] },
  libraw_get_cam_mul: { args: ["pointer", "int"], returns: "f32" },
  libraw_get_pre_mul: { args: ["pointer", "int"], returns: "f32" },
  libraw_get_rgb_cam: { args: ["pointer", "int", "int"], returns: "f32" },
  libraw_get_color_maximum: { args: ["pointer"], returns: "int" },
  libraw_set_output_tif: { args: ["pointer", "int"] }
} as const satisfies Record<string, FFIFunction>;

/**
 * Usage
 * ```typescript
 * using lib = new LibRaw("./libraw_r.24.dylib");
 * lib.open_file('sample.ARW') 
 * lib.unpack()
 * lib.dcraw_process();
 * lib.unpack_thumb();
 * lib.dcraw_ppm_tiff_writer('out.ppm');
 * lib.dcraw_thumb_writer('out.jpeg');
 * lib.close() // if constructed without `using`
 * ```
 */

export class LibRaw {
  close: () => void;
  private rawProcessor: Pointer;
  private lib: Library<typeof ffiFuncs>["symbols"];
  private errPtr = Buffer.alloc(4);
  private static int = `readInt32${endianness()}` as const;
  constructor(libPath: string) {
    const lib = dlopen(libPath, ffiFuncs);
    this.lib = lib.symbols;
    this.close = () => {
      this.lib.libraw_close(this.rawProcessor);
      lib.close()
    };
    this.rawProcessor = this.lib.libraw_init()!;
    this.checkNullPtr(this.rawProcessor);
  }
  [Symbol.dispose]() {
    this.close()
  }

  private checkError(code?: number) {
    const c = this.errPtr[LibRaw.int]();
    this.errPtr.fill(0);
    if (code != undefined && code != 0) {
      throw new Error(this.strerror(code));
    }
    if (code == undefined && c != 0) {
      throw new Error(this.strerror(c));
    }
    return;
  }

  private checkNullPtr(l: Pointer | null): asserts l is Pointer {
    if (l == null) {
      throw new Error("Got null ptr");
    }
  }

  strerror(code: number) {
    const r = this.lib.libraw_strerror(code)
    return r.toString();
  }

  strprogress(progress: number) {
    return this.lib.libraw_strprogress(progress).toString();
  }

  open_file(path: string) {
    const err = this.lib.libraw_open_file(this.rawProcessor, Buffer.from(path));
    this.checkError(err)
  }

  open_buffer(buffer: Buffer) {
    const err = this.lib.libraw_open_buffer(this.rawProcessor, buffer, buffer.byteLength);
    this.checkError(err)
  }

  recycle() {
    this.lib.libraw_recycle(this.rawProcessor);
  }

  recycle_datastream() {
    this.lib.libraw_recycle_datastream(this.rawProcessor);
  }

  raw2image() {
    const err = this.lib.libraw_raw2image(this.rawProcessor);
    this.checkError(err)
  }
  free_image() {
    this.lib.libraw_free_image(this.rawProcessor);
  }

  unpack_thumb() {
    const err = this.lib.libraw_unpack_thumb(this.rawProcessor)
    this.checkError(err)
  }

  dcraw_process() {
    const err = this.lib.libraw_dcraw_process(this.rawProcessor)
    this.checkError(err)
  }


  version() {
    return this.lib.libraw_version().toString();
  }

  versionNumber() {
    return this.lib.libraw_versionNumber()
  }

  cameraList() {
    const l = this.lib.libraw_cameraList();
    this.checkNullPtr(l);
    let i = 0;
    const res: string[] = [];
    while (true) {
      const p = read.ptr(l, i) as Pointer;
      if (!p) break;
      res.push(new CString(p).toString())
      i += PTR_SIZE;
    }
    return res;
  }

  cameraCount() {
    return this.lib.libraw_cameraCount()
  }
  capabilities() {
    return this.lib.libraw_capabilities()
  }

  dcraw_ppm_tiff_writer(fileName: string) {
    const code = this.lib.libraw_dcraw_ppm_tiff_writer(this.rawProcessor, Buffer.from(`${fileName}\0`));
    this.checkError(code);
  }

  dcraw_thumb_writer(fileName: string) {
    const code = this.lib.libraw_dcraw_thumb_writer(this.rawProcessor, Buffer.from(`${fileName}\0`))
    this.checkError(code);
  }

  unpack() {
    this.lib.libraw_unpack(this.rawProcessor)
  }

  dcraw_make_mem_thumb() {
    const ptr = this.lib.libraw_dcraw_make_mem_thumb(this.rawProcessor, this.errPtr);
    this.checkError();
    this.checkNullPtr(ptr);
    return new ProcessedImage(ptr);
  }

  get_iparams() {
    const ptr = this.lib.libraw_get_iparams(this.rawProcessor);
    this.checkNullPtr(ptr)
    return new Iparams(ptr)
  }

  get_iwidth() {
    return this.lib.libraw_get_iwidth(this.rawProcessor);
  }

  get_iheight() {
    return this.lib.libraw_get_iheight(this.rawProcessor);
  }

  get_raw_width() {
    return this.lib.libraw_get_raw_width(this.rawProcessor);
  }

  get_raw_height() {
    return this.lib.libraw_get_raw_height(this.rawProcessor);
  }

  get_lensinfo() {
    const ptr = this.lib.libraw_get_lensinfo(this.rawProcessor);
    this.checkNullPtr(ptr);
    return new LensInfo(ptr);
  }

  get_imgother() {
    const ptr = this.lib.libraw_get_imgother(this.rawProcessor);
    this.checkNullPtr(ptr);
    return new ImageOther(ptr);
  }

  dcraw_make_mem_image() {
    const ptr = this.lib.libraw_dcraw_make_mem_image(this.rawProcessor, this.errPtr);
    this.checkNullPtr(ptr)
    this.checkError()
    return new ProcessedImage(ptr);
  }

  dcraw_clear_mem(ptr: Pointer) {
    this.lib.libraw_dcraw_clear_mem(ptr);
  }

  get_decoder_info() {
    const info = DecoderInfo.new();
    const code = this.lib.libraw_get_decoder_info(this.rawProcessor, DecoderInfo.pointerTo(info));
    this.checkError(code);
    return info;
  }

  adjust_sizes_info_only() {
    const code = this.lib.libraw_adjust_sizes_info_only(this.rawProcessor)
    this.checkError(code);
  }

  COLOR(row: number, col: number) {
    const color = this.lib.libraw_COLOR(this.rawProcessor, row, col)
    return color;
  }

  subtract_black() {
    this.lib.libraw_subtract_black(this.rawProcessor)
  }

  unpack_thumb_ex(n: number) {
    const code = this.lib.libraw_unpack_thumb_ex(this.rawProcessor, n);
    this.checkError(code);
  }

  open_bayer(
    data: Buffer,
    raw_width: number,
    raw_height: number, left_margin: number,
    top_margin: number, right_margin: number,
    bottom_margin: number, procflags: number,
    bayer_battern: number,
    unused_bits: number, otherflags: number,
    black_level: number
  ) {
    const code = this.lib.libraw_open_bayer(
      this.rawProcessor,
      data,
      data.byteLength,
      raw_width,
      raw_height,
      left_margin, top_margin, right_margin, bottom_margin,
      procflags, bayer_battern, unused_bits, otherflags,
      black_level
    );
    this.checkError(code);
  }

  unpack_function_name() {
    return this.lib.libraw_unpack_function_name(this.rawProcessor).toString();
  }

  set_demosaic(value: number) {
    this.lib.libraw_set_demosaic(this.rawProcessor, value);
  }

  set_output_color(value: number) {
    this.lib.libraw_set_output_color(this.rawProcessor, value);
  }

  set_adjust_maximum_thr(value: number) {
    this.lib.libraw_set_adjust_maximum_thr(this.rawProcessor, value);
  }

  set_user_mul(index: number, value: number) {
    this.lib.libraw_set_user_mul(this.rawProcessor, index, value);
  }

  set_output_bps(value: number) {
    this.lib.libraw_set_output_bps(this.rawProcessor, value);
  }

  set_gamma(index: number, value: number) {
    this.lib.libraw_set_gamma(this.rawProcessor, index, value);
  }

  set_no_auto_bright(value: number) {
    this.lib.libraw_set_no_auto_bright(this.rawProcessor, value);
  }

  set_bright(value: number) {
    this.lib.libraw_set_bright(this.rawProcessor, value);
  }

  set_highlight(value: number) {
    this.lib.libraw_set_highlight(this.rawProcessor, value);
  }

  set_fbdd_noiserd(value: number) {
    this.lib.libraw_set_fbdd_noiserd(this.rawProcessor, value);
  }

  get_cam_mul(index: number) {
    return this.lib.libraw_get_cam_mul(this.rawProcessor, index);
  }

  get_pre_mul(index: number) {
    return this.lib.libraw_get_pre_mul(this.rawProcessor, index);
  }

  get_rgb_cam(index1: number, index2: number) {
    return this.lib.libraw_get_rgb_cam(this.rawProcessor, index1, index2);
  }

  libraw_get_color_maximum() {
    return this.lib.libraw_get_color_maximum(this.rawProcessor);
  }

}

