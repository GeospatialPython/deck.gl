const IMAGES_DIRECTORY = './gamepad/'

export const IMAGES = [
  '1.png',
  '2.png',
  '3.png',
  '4.png'].map(name => ({src: IMAGES_DIRECTORY + name, focused: false}))