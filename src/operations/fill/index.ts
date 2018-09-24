import ImageDefinition, { DefinitionRequirement } from '../../imagedef';
import getLargestFaceGravityTranslation from '../../lib/getLargestFaceGravityTranslation';
import getMagickOffset from '../../lib/getMagickOffset';
import scaleFace from '../../lib/scaleFace';
import transformFace from '../../lib/transformFace';
import { Gravity } from '../Gravity';
import { magickGravityMap } from '../magickGravityMap';
import Operation from './../operation';
import { FillConfig } from './types';

const gravityTransform = (config: FillConfig, state: ImageDefinition) => {
  const width = config.width as number;
  const height = config.height as number;
  const scale = state.width < state.height ?
    state.width / width : state.height / height;
  let translate;
  let clip;
  if (config.gravity === 'face') {
    const widthBefore = state.width / scale;
    const heightBefore = state.height / scale;
    translate = getLargestFaceGravityTranslation(
      width,
      height,
      {
        ...state,
        width: widthBefore,
        height: heightBefore,
      },
      (state.faces || []).map(scaleFace({ scale })),
    );
    clip = {
      top: ((heightBefore - height) / 2) + translate.y,
      left: ((widthBefore - width) / 2) + translate.x,
      right: ((widthBefore - width) / 2) + translate.x,
      bottom: ((heightBefore - height) / 2) + translate.y,
    };
  }

  return {
    scale,
    translate,
    clip,
  };
};

export const magickOptions = (config: FillConfig, state: ImageDefinition): string[] => {
  const gravity = config.gravity as Gravity;
  const { translate } = gravityTransform(config, state);
  const offset = getMagickOffset(translate);
  return [
    '-',
    `-resize ${config.width}x${config.height}^`,
    `-gravity ${magickGravityMap[gravity]}`,
    `-extent ${config.width}x${config.height}${offset}`,
    `${state.type}:-`,
  ];
};

export const transformState = (config: FillConfig, state: ImageDefinition): ImageDefinition => {
  const { translate, scale, clip } = gravityTransform(config, state);
  return {
    ...state,
    width: config.width as number,
    height: config.height as number,
    ...state.faces && {
      faces: state.faces.map(transformFace([
        { scale: { scale } },
        ...translate ? [{ translate: { x: -translate.x, y: -translate.y } }] : [],
        ...clip ? [{ translate: { x: -clip.left, y: -clip.top } }] : [],
      ])),
    },
  };
};

export const defaultConfig: FillConfig = {
  width: 99999,
  height: 99999,
  gravity: 'center',
};

export default class Fill implements Operation {
  public config: FillConfig;
  constructor(config: FillConfig) {
    this.config = { ...defaultConfig, ...config };
  }

  public requirements(): DefinitionRequirement[] {
    if (this.config.gravity === 'face') {
      return ['faces'];
    }
    return [];
  }

  public execute(state: ImageDefinition): { command: string, state: ImageDefinition } {
    const options = magickOptions(this.config, state);
    return {
      state: transformState(this.config, state),
      command: 'magick ' + options.join(' '),
    };
  }
}
