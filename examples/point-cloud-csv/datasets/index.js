export const DEFAULT_MAPPING = {
  x: 0, y: 1, z: 2, s: 3, r: 4, g: 5, b: 6, t: 7, i: 8
}
export const DEFAULT_LABELS = {
  0: 'X',
  1: 'Y',
  2: 'Z',
  3: 'Size',
  4: 'Red',
  5: 'Green',
  6: 'Blue',
  7: 'Time',
  8: 'Information'
}
export const DEFAULT_SCALE = {min: -0.5, max: 0.5, type: 'linear'}
export const DEFAULT_RANGE = [-0.5, 0.5]
export const DEFAULT_RANGES = {
  x: DEFAULT_RANGE,
  y: DEFAULT_RANGE,
  z: DEFAULT_RANGE
}

export const datasets = [
  {
    id: 0,
    name: 'DNA Molecule',
    description: 'Dataset of molecules',
    file: './datasets/3.csv',
    filetype: 'csv',
    focused: false,
    meta: {
      mapping: {x: 0, y: 1, z: 2, s: 3, r: 4, g: 5, b: 6},
      labels: DEFAULT_LABELS,
      units: {
        x: {type: 'append', value: 'mm'},
        y: {type: 'append', value: 'mm'},
        z: {type: 'append', value: 'mm'}
      },
      scale: {
        x: DEFAULT_SCALE,
        y: DEFAULT_SCALE,
        z: DEFAULT_SCALE
      },
      range: {
        ...DEFAULT_RANGES,
        z: [-0.5, 3]
      }
    }
  },
  {
    id: 1,
    name: 'World GDP',
    description: 'Country wise GDP, population etc.',
    file: './datasets/4.csv',
    filetype: 'csv',
    focused: false,
    meta: {
      mapping: {x: 0, y: 2, z: 1, s: 3, r: 4, g: 5, b: 6},
      labels: {
        0: 'GDP (US$)',
        1: 'Life Expectancy (years)',
        2: 'Population',
        3: 'Size',
        4: 'Red',
        5: 'Blue',
        6: 'Green'
      },
      units: {
        x: {type: 'append', value: ''},
        y: {type: 'append', value: ''},
        z: {type: 'append', value: ''}
      },
      scale: {
        x: DEFAULT_SCALE,
        y: {min: -0.5, max: 1.0, type: 'log'},
        z: DEFAULT_SCALE
      },
      range: {
        ...DEFAULT_RANGES,
        s: [1, 20],
        y: [-0.5, 2.5]
      }
    }
  },
  {
    id: 2,
    name: 'Bird flocking (1000)',
    description: 'Simulation of boids',
    file: './datasets/boids_1000.csv',
    filetype: 'csv',
    focused: false,
    meta: {
      mapping: {i: 0, x: 1, y: 2, z: 3, s: 4, t: 5, r: 6, g: 7, b: 8},
      labels: DEFAULT_LABELS,
      units: {
        x: {type: 'append', value: 'mm'},
        y: {type: 'append', value: 'mm'},
        z: {
          type: 'substitute', value: [
            [0.0, 'Low'],
            [0.3, 'Medium'],
            [0.7, 'High']
          ]
        }
      },
      scale: {
        x: DEFAULT_SCALE,
        y: DEFAULT_SCALE,
        z: DEFAULT_SCALE
      },
      range: {
        ...DEFAULT_RANGES,
        s: [1, 1.67]
      }
    }
  },
  {
    id: 3,
    name: 'Bird flocking (50,000)',
    description: 'Simulation of boids',
    file: './datasets/boids_1048576.csv',
    filetype: 'csv',
    focused: false,
    meta: {
      mapping: {i: 0, x: 1, y: 2, z: 3, s: 4, t: 5, r: 6, g: 7, b: 8},
      labels: DEFAULT_LABELS,
      units: {
        x: {type: 'append', value: 'mm'},
        y: {type: 'append', value: 'mm'},
        z: {
          type: 'substitute', value: [
            [0.0, 'Low'],
            [0.3, 'Medium'],
            [0.7, 'High']
          ]
        }
      },
      scale: {
        x: DEFAULT_SCALE,
        y: DEFAULT_SCALE,
        z: DEFAULT_SCALE
      },
      range: {
        ...DEFAULT_RANGES,
        s: [1, 1.67]
      }
    }
  }
]