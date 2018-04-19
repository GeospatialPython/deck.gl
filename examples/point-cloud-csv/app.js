/* global document, window, navigator */
/* eslint-disable no-console,no-undef */
import React, { PureComponent } from 'react'
import { createElement, cloneElement } from 'react'
import { render } from 'react-dom'
import DeckGL, {
  COORDINATE_SYSTEM,
  PointCloudLayer,
  experimental,
  Viewport
} from 'deck.gl'

const {OrbitController} = experimental

import { setParameters } from 'luma.gl'

// import WebVRPolyfill from 'webvr-polyfill'
import EmulatedVRDisplay from './vr/emulated-vr-display'

import Papa from 'papaparse'
import { Gamepad } from './gamepad/react-gamepad/lib/'

import PlotLayer from './plot-layer'
import Quaternion from './math/Quaternion'
import Transform from './math/Transform'
import Vec3 from './math/Vec3'
import { datasets } from './datasets'

import { scaleLinear, scaleLog } from 'd3-scale'

import {loadLazFile, parseLazData} from './datasets/laslaz-loader';

const DATA_REPO = 'https://raw.githubusercontent.com/uber-common/deck.gl-data/master'
const FILE_PATH = 'examples/point-cloud-laz/indoor.laz'

import { LineLayer } from 'deck.gl'
import MenuLayer from './vr/menu-layer'

function normalizePosition (points) {
  let xMin = Infinity
  let yMin = Infinity
  let zMin = Infinity
  let xMax = -Infinity
  let yMax = -Infinity
  let zMax = -Infinity

  for (let i = 0; i < points.length; i++) {
    xMin = Math.min(xMin, points[i].position[0])
    yMin = Math.min(yMin, points[i].position[1])
    zMin = Math.min(zMin, points[i].position[2])
    xMax = Math.max(xMax, points[i].position[0])
    yMax = Math.max(yMax, points[i].position[1])
    zMax = Math.max(zMax, points[i].position[2])
  }

  const scale = Math.max(...[xMax - xMin, yMax - yMin, zMax - zMin])
  const xMid = (xMin + xMax) / 2
  const yMid = (yMin + yMax) / 2
  const zMid = (zMin + zMax) / 2

  for (let i = 0; i < points.length; i++) {
    points[i].position[0] = (points[i].position[0] - xMid) / scale
    points[i].position[1] = (points[i].position[1] - yMid) / scale
    points[i].position[2] = (points[i].position[2] - zMid) / scale
  }
}

function normalizeArray (min, max, nmin = 0.0, nmax = 1.0) {
  const delta = max - min
  return val => (((val - min) / delta) * (nmax - nmin)) + nmin
}

function normalize (val, min, max, nmin = 0.0, nmax = 1.0) {
  const delta = max - min
  return (((val - min) / delta) * (nmax - nmin)) + nmin
}

class Example extends PureComponent {
  constructor (props) {
    super(props)

    this._onViewportChange = this._onViewportChange.bind(this)
    this._onInitialized = this._onInitialized.bind(this)
    this._onResize = this._onResize.bind(this)
    this._onUpdate = this._onUpdate.bind(this)
    this.positionLoop = this.positionLoop.bind(this)
    this._renderViewports = this._renderViewports.bind(this)
    this.axisChangeHandler = this.axisChangeHandler.bind(this)
    this.connectHandler = this.connectHandler.bind(this)
    this.disconnectHandler = this.disconnectHandler.bind(this)
    this.buttonChangeHandler = this.buttonChangeHandler.bind(this)
    this.plotLayer = this.plotLayer.bind(this)
    this._onHover = this._onHover.bind(this)
    this._onClick = this._onClick.bind(this)
    this.setOrientation = this.setOrientation.bind(this)
    this._loadDataset = this._loadDataset.bind(this)
    this._getPoints = this._getPoints.bind(this)
    this._getLimits = this._getLimits.bind(this)
    this._parseCSV = this._parseCSV.bind(this)
    this.toggleMenu = this.toggleMenu.bind(this)
    this._buildTimeline = this._buildTimeline.bind(this)
    this._timer = this._timer.bind(this)
    this._tick = this._tick.bind(this)
    this._targetToString = this._targetToString.bind(this)
    this._infoToString = this._infoToString.bind(this)

    this.state = {
      width: 0,
      height: 0,
      points: [],
      progress: 0,
      rotating: false,
      deckRef: null,
      viewport: {
        lookAt: [0, 0, 0],
        distance: 1,
        rotationX: 0,
        rotationOrbit: 0,
        orbitAxis: 'Y',
        fov: 30,
        minDistance: 0.5,
        maxDistance: 3
      },
      vrDisplay: new EmulatedVRDisplay(),
      vrEnabled: false,
      emulatedDisplay: new EmulatedVRDisplay(),
      emulatedPose: {
        orientation: [0, 0, 0, 0],
        position: [0, 0, 1],
        firstOrientation: null
      },
      hasGamepad: false,
      gamepad: {
        cameraAxisX: 0.0,
        cameraAxisY: 0.0,
        cameraAxisZ: 0.0
      },
      hasPosition: false,
      scale: {x: [-0.5, 0.5], y: [-0.5, 0.5], z: [-0.5, 0.5], s: [1, 10]},
      range: {x: [0, 1], y: [0, 1], z: [0, 1]},
      limits: {
        xLimit: {min: 0, max: 1},
        yLimit: {min: 0, max: 1},
        zLimit: {min: 0, max: 1}
      },
      gridLabels: {x: '', y: '', z: ''},
      units: {
        x: {type: 'append', value: 'units'},
        y: {type: 'append', value: 'units'},
        z: {type: 'append', value: 'units'}
      },
      labelHidden: false,
      vrViewports: this.getDefaultViewport(100, 100),
      menuVisible: false,
      datasets,
      activeDataset: datasets[0],
      time: {
        lastDataset: null,
        values: [],
        currentValue: null,
        enabled: false,
        currentIndex: 0,
        speed: 1,
        maxSpeed: 5,
        timeline: [],
        interval: 20,
        isPlaying: false,
        intervalId: 0,
        startIndex: 0,
        endIndex: 0
      },
      gaze: {
        active: false,
        target: null
      },
      filters: [],
      system: {
        busy: false
      }
    }
    window.instance = this
    window.math = {Quaternion, Transform, Vec3}
  }

  setOrientation (a) {
    if (a && a.length === 4) {
      const {emulatedPose} = this.state
      console.log('emulatedPose', emulatedPose.orientation)
      emulatedPose.orientation = a
      this.setState({
        ...emulatedPose
      })
      console.log('emulatedPose', emulatedPose.orientation)
    }
  }

  componentWillMount () {
    window.addEventListener('resize', this._onResize)
    this._onResize()
  }

  componentDidMount () {
    this._loadDataset()
    this._initVRDisplay()
    window.requestAnimationFrame(this._onUpdate)
  }

  _tick () {
    const {time} = this.state
    const {currentIndex, endIndex, isPlaying} = time
    if (!time.enabled) {
      return
    }
    if (isPlaying) {
      if (currentIndex < endIndex) {
        time.currentIndex += 1
        this.setState({
          time
        })
      } else if (currentIndex >= endIndex) {
        time.currentIndex = endIndex
        this._timer().stop()
      }
    } else {
      this._timer().stop()
    }
    console.log('tick')
  }

  _timer () {
    const {time} = this.state
    return {
      play: () => {
        const {intervalId, interval, isPlaying} = time
        if (!isPlaying) {
          clearInterval(intervalId)
          time.isPlaying = true
          time.intervalId = setInterval(this._tick, interval)
          this.setState({time})
        }
        console.info('[+] play >')
      },
      stop: () => {
        const {intervalId} = time
        clearInterval(intervalId)
        console.info('[+] stop x')
        time.isPlaying = false
        this.setState({time})
      },
      reset: () => {
        const {startIndex} = time
        time.currentIndex = startIndex
        this.setState({time})
        console.info('[+] reset x')
        this._timer().stop()
      },
      toggleAnimation: () => {
        console.info('[+] toggle ')
        const {isPlaying} = time
        console.info('[+] isPlaying ', isPlaying)
        if (isPlaying) {
          this._timer().stop()
        } else {
          this._timer().play()
        }
      }
    }
  }

  _loadDataset (dataset = this.state.activeDataset, nextMapping = null) {
    const {_getPoints: getPoints} = this
    if (!dataset) {
      console.error('Dataset is null.')
      return
    }

    this.setState({nextMapping, system: {busy: true}})

    getPoints(dataset, (points) => {
      this.setState({
        points, progress: 1, activeDataset: dataset,
        system: {busy: false}
      })
    })
  }

  _getPoints (dataset, callback) {
    const {_parseCSV: parseCSV} = this
    const {file, filetype} = dataset
    switch (filetype) {
      case 'CSV':
      case 'csv':
        Papa.parse(file, {
          download: true,
          complete: csv => callback(parseCSV(csv, dataset))
        })
        break
      case 'LAZ':
      case 'laz':
        loadLazFile(dataset.file).then(laz => {
          callback(this._parseLAZ(laz, dataset))
        })
        break
      default:
        break
    }
  }

  normalize(points) {
    let xMin = Infinity;
    let yMin = Infinity;
    let zMin = Infinity;
    let xMax = -Infinity;
    let yMax = -Infinity;
    let zMax = -Infinity;

    for (let i = 0; i < points.length; i++) {
      xMin = Math.min(xMin, points[i].position[0]);
      yMin = Math.min(yMin, points[i].position[1]);
      zMin = Math.min(zMin, points[i].position[2]);
      xMax = Math.max(xMax, points[i].position[0]);
      yMax = Math.max(yMax, points[i].position[1]);
      zMax = Math.max(zMax, points[i].position[2]);
    }

    const scale = Math.max(...[xMax - xMin, yMax - yMin, zMax - zMin]);
    const xMid = (xMin + xMax) / 2;
    const yMid = (yMin + yMax) / 2;
    const zMid = (zMin + zMax) / 2;

    for (let i = 0; i < points.length; i++) {
      points[i].position[0] = (points[i].position[0] - xMid) / scale;
      points[i].position[1] = (points[i].position[1] - yMid) / scale;
      points[i].position[2] = (points[i].position[2] - zMid) / scale;
    }
  }

  _parseLAZ (laz, dataset) {
    const skip = 100;
    const points = [];
    parseLazData(laz, skip, (decoder, progress) => {
      for (let i = 0; i < decoder.pointsCount; i++) {
        const {color, position} = decoder.getPoint(i);
        points.push({color, position, size: 1});
      }
      this.normalize(points);
    });
    return points;
  }

  _parseCSV (csv, dataset) {
    const {data} = csv
    const {meta, file} = dataset
    const {nextMapping} = this.state
    const mapping = nextMapping || meta.mapping
    const {range, scale, labels, units} = meta
    const {x, y, z, s, r, g, b, t, i} = mapping
    const {_getScale: getScale, _getLimits: getLimits, _getInverseScale: getInverseScale} = this
    const limits = getLimits(data, mapping)
    const {xLimit, yLimit, zLimit, sLimit, bLimit} = limits
    const colorMultiplier = bLimit.max > 2 ? 1.0 : 255
    const scaleRange = range.s = range.s || [sLimit.min, sLimit.max]
    const points = []
    const filters = []
    const max = Math.max(...Object.values(mapping)) + 1

    for (let idx = 1; idx < data.length; idx++) {
      const d = data[idx]
      const point = {}

      point.position = [
        getScale(xLimit, range.x, scale.x.type)(d[x]),
        getScale(yLimit, range.y, scale.y.type)(d[y]),
        getScale(zLimit, range.z, scale.z.type)(d[z])
      ]

      if (Math.max(r, g, b) < max) {
        point.color = [
          d[r] * colorMultiplier,
          d[g] * colorMultiplier,
          d[b] * colorMultiplier]
      } else {
        point.color = [40, z * 128 + 128, 160]
      }

      if (s < max) {
        point.size = getScale(sLimit, scaleRange)(d[s])
        point.color = point.color.concat(getScale(sLimit, scaleRange)(d[s]))
      } else {
        point.size = 0.02
        point.color = point.color.concat(0.02)
      }

      if (i < max) {
        point.info = d[i]
      }

      if (t < max) {
        point.time = Number(d[t])
      }

      points.push(point)
    }

    const gridLabels = {}

    gridLabels.x = labels[mapping.x]
    gridLabels.y = labels[mapping.y]
    gridLabels.z = labels[mapping.z]
    gridLabels.s = labels[mapping.s]

    let timeValues = []
    let timeline = []
    const hasTime = t < max
    if (hasTime) {

      filters.push({
        key: 'time',
        mappingIndex: t
      })

      const uniqueFilter = (value, index, self) => (self.indexOf(value) ===
        index)

      for (let idx = 1; idx < data.length; idx++) {
        timeValues.push(data[idx][t])
      }

      timeValues = timeValues.filter(uniqueFilter).map(Number)

      timeline = this._buildTimeline(points, timeValues.length)
    }

    this.setState({
        activeMapping: mapping,
        filters,
        range,
        scale,
        units,
        limits,
        gridLabels,
        time: {
          enabled: hasTime,
          currentIndex: 0,
          startIndex: timeValues[0],
          endIndex: timeValues[timeValues.length - 1],
          values: timeValues,
          timeline,
          isPlaying: false
        }
      }
    )
    console.log('limits', limits)

    return points
  }

  _buildTimeline (points, frames) {
    const timeline = new Array(frames)

    for (let i = 0; i < points.length; i++) {
      if (!timeline[points[i].time]) {
        timeline[points[i].time] = []
      }
      timeline[points[i].time].push(points[i])
    }

    return timeline
  }

  _applyFilters (points) {
    const {filters, time} = this.state

    if (filters && filters.length === 0) {
      return points
    }

    let filteredPoints = []

    filters.forEach(filter => {
      if (filter.key === 'time') {
        const currentValue = time.values[time.currentIndex]
        console.log('currentValue', currentValue)
        console.log('time.timeline', time.timeline)
        filteredPoints = time.timeline[currentValue]
      }
    })

    return filteredPoints
  }

  _getLimits (data, mapping, startIndex = 1) {
    const {x, y, z, s, b} = mapping

    let xMin = Infinity
    let xMax = -Infinity
    let yMin = Infinity
    let yMax = -Infinity
    let zMin = Infinity
    let zMax = -Infinity
    let bMin = Infinity
    let bMax = -Infinity
    let sMin = Infinity
    let sMax = -Infinity

    for (let i = startIndex; i < data.length; i++) {
      const point = data[i]

      xMin = Math.min(xMin, point[x])
      yMin = Math.min(yMin, point[y])
      zMin = Math.min(zMin, point[z])
      bMin = Math.min(bMin, point[b])
      sMin = Math.min(sMin, point[s])

      xMax = Math.max(xMax, point[x])
      yMax = Math.max(yMax, point[y])
      zMax = Math.max(zMax, point[z])
      bMax = Math.max(bMax, point[b])
      sMax = Math.max(sMax, point[s])
    }

    return {
      xLimit: {min: xMin, max: xMax},
      yLimit: {min: yMin, max: yMax},
      zLimit: {min: zMin, max: zMax},
      bLimit: {min: bMin, max: bMax},
      sLimit: {min: sMin, max: sMax}
    }
  }

  connectHandler (gamepadIndex) {
    console.log(`Gamepad ${gamepadIndex} connected !`)
    const gamepad = navigator.getGamepads()[gamepadIndex]
    if (gamepad.timestamp > 0) {
      this.setState({
        hasGamepad: true
      })
      console.log('Good gamepad', gamepad)
    }
  }

  disconnectHandler (gamepadIndex) {
    console.log(`Gamepad ${gamepadIndex} disconnected !`)
    this.setState({
      hasGamepad: false
    })
  }

  toggleMenu () {
    this.setState({menuVisible: !this.state.menuVisible})
  }

  buttonChangeHandler (buttonName, down) {
    const {emulatedPose, menu, menuVisible, time} = this.state
    console.log(buttonName, down)
    switch (buttonName) {
      case 'Y':
        if (down) {
          this.toggleMenu()
          console.log('menuVisible', this.state.menuVisible)
        }
        break
      case 'A':
        if (down && menuVisible) {
          menu.navigate().press()
        }
        break
      case 'X':
        if (down) {
          if (!menuVisible) {
            menu._changeView('controller-instructions')
          }
          this.toggleMenu()
        }
        break
      case 'RS':
        if (down) {
          emulatedPose.position = [0, 0, 0]
        }
        break
      case 'DPadUp':
        if (down && menuVisible) {
          menu.navigate().up()
        }
        break
      case 'DPadDown':
        if (down && menuVisible) {
          menu.navigate().down()
        }
        break
      case 'DPadLeft':
        if (down && menuVisible) {
          menu.navigate().left()
        }
        break
      case 'DPadRight':
        if (down && menuVisible) {
          menu.navigate().right()
        }
        break
      case 'RB':
        if (down) {
          if (menuVisible) {
            menu.navigate().next()
          } else {
            const {gaze} = this.state
            this.setState({
              gaze: {
                ...gaze,
                active: true
              }
            })
            const {width, height} = this.state
            const {deckGL} = this
            const gazePoint = {x: width / 4, y: height / 2}
            if (deckGL) {
              const pickedObject = deckGL.pickObject(gazePoint, 10)
              if (pickedObject) {
                console.log('picked', pickedObject)
              }
              this.setState({
                gaze: {
                  active: true,
                  target: pickedObject
                }
              })
            } else {
              console.log('deckGL is undefined')
            }
          }
        } else {
          this.setState({
            gaze: {
              active: false,
              target: null
            }
          })
        }
        break
      case 'LB':
        if (down) {
          if (menuVisible) {
            menu.navigate().prev()
          } else {
            this.setState({labelHidden: !this.state.labelHidden})
          }
        }
        break
      case 'LS':
        if (down) {
          this._timer().reset()
        }
        break
      case 'Start':
        if (down) {
          this._timer().toggleAnimation()
        }
        break
    }
  }

  axisChangeHandler (axisName, value, previousValue) {
    const {gamepad, time} = this.state
    const inc = 0.01
    console.log(axisName, value)
    switch (axisName) {
      case 'LeftStickX':
        if (value !== 0) {
          gamepad.cameraAxisX += inc * value
        } else {
          gamepad.cameraAxisX = 0
        }
        break
      case 'LeftStickY':
        if (value !== 0) {
          gamepad.cameraAxisY += inc * value
        } else {
          gamepad.cameraAxisY = 0
        }
        break
      case 'RightStickY':
        if (value !== 0) {
          gamepad.cameraAxisZ += inc * value
        } else {
          gamepad.cameraAxisZ = 0
        }
        break
      case 'RightTrigger':
        if (value !== 0) {
          if (time.currentIndex + time.speed < time.values.length) {
            this.setState({
              time: {
                ...time,
                currentIndex: time.currentIndex + time.speed,
                speed: time.speed + 40
              }
            })
          }
        } else {
          this.setState({
            time: {
              ...time,
              speed: 1
            }
          })
        }
        break
      case 'LeftTrigger':
        if (value !== 0) {
          if (time.currentIndex - time.speed >= 0) {
            this.setState({
              time: {
                ...time,
                currentIndex: time.currentIndex - time.speed,
                speed: time.speed + 40
              }
            })
          } else {
            this.setState({
              time: {
                ...time,
                speed: 1
              }
            })
          }
        }
        break
    }
    this.setState({
      gamepad
    })
  }

  componentWillUnmount () {
    window.removeEventListener('resize', this._onResize)
  }

  _getScale ({min, max}, range = [-0.5, 0.5], type = 'linear') {
    if (type === 'log') {
      return scaleLog().domain([min, max]).range(range)
    }
    return scaleLinear().domain([min, max]).range(range)
  }

  _getInverseScale ({min, max}, range = [-0.5, 0.5], type = 'linear') {
    if (type === 'log') {
      return scaleLog().domain([range[0], range[1]]).range([min, max])
    }
    return scaleLinear().domain([range[0], range[1]]).range([min, max])
  }

  _getScaleFor (range = [-0.5, 0.5], type = 'linear') {
    return ({min, max}) => {
      if (type === 'log') {
        return scaleLog().domain([min, max]).range(range)
      }
      return scaleLinear().domain([min, max]).range(range)
    }
  }

  _getUnitFormat (format) {
    return (x) => {
      if (format.type === 'append') {
        return x.toFixed(2) + format.value
      }
      return x.toFixed(2)
    }
  }

  _onResize () {
    const size = {width: window.innerWidth, height: window.innerHeight}
    this.setState(size)
    const newViewport = OrbitController.getViewport(
      Object.assign(this.state.viewport, size)
    ).fitBounds([1, 1, 1])
    this._onViewportChange(newViewport)
  }

  _onInitialized (gl) {
    setParameters(gl, {
      // clearColor: [0.01, 0.01, 0.04, 1]
      // clearColor: [0.07, 0.14, 0.19, 0]
      // blendFunc: [gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA],
    })
    const {width, height} = this.state
    const gazePoint = {x: width / 4, y: height / 2}
    const {deckGL} = this
    setInterval(() => {
      const {activeDataset, gaze} = this.state
      if (activeDataset.filetype !== 'laz' && gaze.active && deckGL) {
        this.setState({
          gaze: {
            active: true,
            target: deckGL.pickObject(gazePoint, 10)
          }
        })
      }
    }, 100)
  }

  _onViewportChange (viewport) {
    this.setState({
      // rotating: !viewport.isDragging,
      viewport: {...this.state.viewport, ...viewport}
    })
  }

  _onUpdate () {
    const {system} = this.state
    if (system.busy) {
      console.log('System is busy.')
      setTimeout(() => {
        console.log('Trying again...')
        this._onUpdate()
      }, 1000)
      return
    }
    this.forceUpdate() // explicitly refresh state; removing this breaks frame update in VR
    window.requestAnimationFrame(this._onUpdate)
  }

  _renderCsvPointCloudLayer () {
    const {points, time, activeDataset} = this.state

    if (!points || points.length === 0) {
      return null
    }

    if(activeDataset.filetype === 'csv') {
      return new PointCloudLayer({
        id: 'laz-point-cloud-layer',
        data: time.enabled ? time.timeline[time.currentIndex] : points,
        coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
        getPosition: d => d.position,
        // getSize: d => d.size,
        getNormal: d => d.position.map(Math.abs).map(Math.sqrt),
        // getColor: d => [255, 255, 255, 128],
        radiusPixels: 10,
        pickable: true
      })
    }
    return new PointCloudLayer({
      id: 'laz-point-cloud-layer',
      data: points,
      coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
      getPosition: d => d.position,
      getNormal: d => [0, 0.5, 0.2],
      getColor: d => [255, 255, 255, 5],
      radiusPixels: 0.1
    });
  }

  _initVRDisplay () {
    /* eslint-disable no-unused-vars */
    if (typeof WebVRPolyfill !== 'undefined') {
      const polyfill = new WebVRPolyfill({
        PROVIDE_MOBILE_VRDISPLAY: true,
        DPDB_URL: './vr/dpdb.json'
      })
      console.warn('WebVRPolyfill is available.')
    } else {
      console.warn('WebVRPolyfill is not available.')
    }
    /* eslint-disable no-unused-vars */

    if (navigator && navigator.getVRDisplays) {
      navigator.getVRDisplays().then(displays => {
        const vrDisplay = displays[0]
        if (vrDisplay) {
          const {hasPosition} = vrDisplay.capabilities
          this.setState({vrDisplay, vrEnabled: true, hasPosition})
        }
      })
    }
  }

  _renderViewports () {
    const {width, height, vrDisplay, emulatedPose, emulatedDisplay} = this.state
    const frameData = vrDisplay.isEmulated ? {} : new window.VRFrameData()
    let gotFrameData = false
    if (vrDisplay.isEmulated) {
      const updatedPosition = this.positionLoop(emulatedPose.position,
        [0, 0, 0, 1])
      const newPose = Object.assign({}, emulatedPose,
        {position: updatedPosition})
      gotFrameData = vrDisplay.getFrameDataFromPose(frameData, newPose)
    } else {
      const newFrameData = new window.VRFrameData()
      vrDisplay.getFrameData(newFrameData)
      const orientation = newFrameData.pose.orientation || [0, 0, 0, 1]
      const updatedPosition = this.positionLoop(emulatedPose.position,
        orientation)
      const newPose = Object.assign({}, emulatedPose,
        {position: updatedPosition})
      newPose.orientation = orientation
      gotFrameData = emulatedDisplay.getFrameDataFromPose(frameData, newPose)
      emulatedPose.position = newPose.position
    }
    if (gotFrameData) {
      return [
        new Viewport({
          x: 0,
          width: width / 2,
          height,
          viewMatrix: frameData.leftViewMatrix,
          projectionMatrix: frameData.leftProjectionMatrix
        }),
        new Viewport({
          x: width / 2,
          width: width / 2,
          height,
          viewMatrix: frameData.rightViewMatrix,
          projectionMatrix: frameData.rightProjectionMatrix
        })
      ]
    }
    return this.getDefaultViewport(width, height)
  }

  getDefaultViewport (width, height) {
    return [
      new Viewport({
        x: 0,
        width: width / 2,
        height
      }),
      new Viewport({
        x: width / 2,
        width: width / 2,
        height
      })
    ]
  }

  _toggleDisplayMode () {
    const {vrEnabled} = this.state

    this.setState({
      vrEnabled: !vrEnabled
    })
  }

  plotLayer () {
    const {_getScale: getScale} = this
    const {limits, range, scale, points, units, gridLabels, labelHidden} = this.state
    const {xLimit, yLimit, zLimit} = limits

    return new PlotLayer({
      getColor: (x, y, z) => [40, z * 128 + 128, 160, 128],
      getXScale: this._getScaleFor(range.x, scale.x.type),
      getYScale: this._getScaleFor(range.z, scale.y.type),
      getZScale: this._getScaleFor(range.y, scale.z.type),
      points,
      // vCount: resolution,
      drawAxes: true,
      axesPadding: 0,
      axesColor: [255, 255, 255, 128],
      opacity: 1,
      color: [255, 255, 255, 128],
      pickable: true, // Boolean(this._onHover),
      onHover: this._onHover,
      onClick: this._onClick,
      xTitle: gridLabels.x,
      yTitle: gridLabels.z,
      zTitle: gridLabels.y,
      xTickFormat: this._getUnitFormat(units.x),
      yTickFormat: this._getUnitFormat(units.z),
      zTickFormat: this._getUnitFormat(units.y),
      labelHidden
    })
  }

  _onHover (info) {
    this._onClick(info)
  }

  _onClick (info) {
    console.log('Clicked', info)
    const hoverInfo = info || null
    if (!hoverInfo) {
      this.setState({hoverInfo: null})
      return
    }
    hoverInfo.sample = hoverInfo.object.position
    if (hoverInfo !== this.state.hoverInfo) {
      this.setState({hoverInfo})
    }
  }

  _renderDeckGLCanvas () {
    const {width, height, viewport, vrEnabled, hoverInfo, activeDataset} = this.state
    const isLazData = activeDataset.filetype === 'laz'
    const layers = isLazData ? [this._renderCsvPointCloudLayer()] : [this.plotLayer(), this._renderCsvPointCloudLayer()]
    if (vrEnabled) {
      return (
        <DeckGL
          width={width}
          height={height}
          viewports={this._renderViewports()}
          layers={layers}
          onWebGLInitialized={this._onInitialized}
          onLayerClick={this._onClick}
          ref={deck => { this.deckGL = deck }}
        />
      )
    }

    const canvasProps = {width, height, ...viewport}
    const glViewport = OrbitController.getViewport(canvasProps)

    return (
      <OrbitController
        {...canvasProps}
        ref={canvas => {
          this._canvas = canvas
        }}
        onViewportChange={this._onViewportChange}
      >
        <DeckGL
          width={width}
          height={height}
          viewport={glViewport}
          layers={layers}
          onWebGLInitialized={this._onInitialized}
          onLayerClick={this._onClick}
        />
        {hoverInfo && (
          <div className="tooltip"
               style={{left: hoverInfo.x, top: hoverInfo.y}}>
            {hoverInfo.sample.map(x => x.toFixed(3)).join(', ')}
          </div>
        )}
      </OrbitController>
    )
  }

  _renderProgressInfo () {
    const progress = (this.state.progress * 100).toFixed(2)
    return (
      <div>
        <div
          style={{
            position: 'absolute',
            left: '8px',
            bottom: '8px',
            color: '#FFF',
            fontSize: '15px'
          }}
        >
          {this.state.progress < 1 ? (
            <div>
              <div>This example might not work on mobile devices due to
                browser
                limitations.
              </div>
              <div>Please try checking it with a desktop machine instead.
              </div>
              <div>{`Loading ${progress}%`}</div>
            </div>
          ) : (
            <div>Data source: CSV</div>
          )}
        </div>
        <div
          style={{
            position: 'absolute',
            right: '8px',
            bottom: '8px',
            color: '#FFF',
            fontSize: '15px'
          }}
        >
          {this.state.vrEnabled ? (
            <div>
              {this.state.vrDisplay.isEmulated ? (
                <a onClick={this._toggleDisplayMode.bind(this)}>Exit
                  stereoscopic view.</a>
              ) : (
                <br/>
              )}
            </div>
          ) : (
            <div>
              <div>No VR Device found.</div>
              <a onClick={this._toggleDisplayMode.bind(this)}>Enter
                stereoscopic
                view.</a>
            </div>
          )}
        </div>
        <div className="Gamepad">
          <Gamepad
            gamepadIndex={0}
            onConnect={this.connectHandler}
            onDisconnect={this.disconnectHandler}
            onAxisChange={this.axisChangeHandler}
            onButtonChange={this.buttonChangeHandler}
          >
            <div/>
          </Gamepad>
          <Gamepad
            gamepadIndex={1}
            onConnect={this.connectHandler}
            onDisconnect={this.disconnectHandler}
            onAxisChange={this.axisChangeHandler}
            onButtonChange={this.buttonChangeHandler}
          >
            <div/>
          </Gamepad>
        </div>
      </div>
    )
  }

  positionLoop (_position, orientation) {
    const {hasGamepad, gamepad} = this.state
    if (orientation && hasGamepad) {
      const position = Array.from(_position)
      const orientationQ = new Quaternion(...Array.from(orientation))
      if (gamepad.cameraAxisX) {
        const direction = gamepad.cameraAxisX < 0 ? -1 : 1
        const resultVector = orientationQ.vmult(Vec3.UNIT_X.scale(direction))
        position[0] += Math.abs(gamepad.cameraAxisX) * resultVector.x
        position[1] += Math.abs(gamepad.cameraAxisX) * resultVector.y
        position[2] += Math.abs(gamepad.cameraAxisX) * resultVector.z
      }
      if (gamepad.cameraAxisY) {
        const direction = gamepad.cameraAxisY < 0 ? -1 : 1
        const resultVector = orientationQ.vmult(Vec3.UNIT_Y.scale(direction))
        position[0] += Math.abs(gamepad.cameraAxisY) * resultVector.x
        position[1] += Math.abs(gamepad.cameraAxisY) * resultVector.y
        position[2] += Math.abs(gamepad.cameraAxisY) * resultVector.z
      }
      if (gamepad.cameraAxisZ) {
        const direction = gamepad.cameraAxisZ < 0 ? 1 : -1
        const resultVector = orientationQ.vmult(Vec3.UNIT_Z.scale(direction))
        position[0] += Math.abs(gamepad.cameraAxisZ) * resultVector.x
        position[1] += Math.abs(gamepad.cameraAxisZ) * resultVector.y
        position[2] += Math.abs(gamepad.cameraAxisZ) * resultVector.z
      }
      return position.map(this.limitTo(4))
    }
    if (_position) {
      return _position
    }
    return [0, 0, 0.5]
  }

  limitTo (limit = 2) {
    return (value) => (Math.abs(value) > limit ? limit : Math.abs(value)) *
      Math.sign(value)
  }

  _targetToString (target) {
    if (!target) {
      return ''
    }
    const {_getInverseScale: getInvScale} = this
    const {gridLabels, range, scale, units, limits} = this.state
    const {xLimit, yLimit, zLimit, sLimit} = limits
    const attrib = target.object
    let title = ''
    let color = 'rgb(255, 255, 255)'
    const info = []

    if (attrib.position) {
      const xValue = getInvScale(xLimit, range.x, scale.x.type)(
        attrib.position[0])
      info.push([gridLabels.x, xValue])
      const yValue = getInvScale(yLimit, range.y, scale.y.type)(
        attrib.position[1])
      info.push([gridLabels.y, yValue])
      const zValue = getInvScale(zLimit, range.z, scale.z.type)(
        attrib.position[2])
      info.push([gridLabels.z, zValue])
    }
    if (attrib.size) {
      const sValue = getInvScale(sLimit, range.s)(
        attrib.size)
      info.push([gridLabels.s, sValue])
    }
    if (attrib.info) {
      title = attrib.info.slice(0, 10)
    }
    if (attrib.color) {
      color = 'rgb(' + attrib.color.join(', ') + ')'
    }
    return this._infoToString(info, title, color)
  }

  _infoToString (info, title, color) {
    if (!info) {
      return ''
    }
    const pointEl = createElement('div', {
      className: 'point', style: {
        backgroundColor: color
      }
    })
    const gazeInfoChildren = []

    const label = createElement('div', {className: 'label'}, title)
    const gazeInfoCol = createElement('div', {className: 'gaze-info-col'},
      pointEl, label)

    gazeInfoChildren.push(gazeInfoCol)

    info.forEach((e) => {
      const labelEl = createElement('div', {className: 'label'}, e[0])
      const valueEl = createElement('div', {className: 'value'}, e[1])
      gazeInfoChildren.push(createElement('div', {className: 'gaze-info-row'},
        labelEl, valueEl))
    })

    const gazeInfoEl = createElement('div', {className: 'gaze-info'},
      ...gazeInfoChildren)

    const stereoscopicViewLeft = createElement('div',
      {className: 'stereoscopic-view-left'}, gazeInfoEl)
    const stereoscopicViewRight = createElement('div',
      {className: 'stereoscopic-view-right'}, gazeInfoEl)

    return createElement('div',
      {className: 'gaze-info-container'}, stereoscopicViewLeft,
      stereoscopicViewRight)
  }

  render () {
    const {width, height, menuVisible, activeDataset, gaze} = this.state
    if (width <= 0 || height <= 0) {
      return null
    }

    return (
      <div
        className={menuVisible
          ? 'menu-layer--visible'
          : 'menu-layer--hidden'}>
        {this._renderDeckGLCanvas()}
        {this._renderProgressInfo()}
        <MenuLayer
          datasets={datasets}
          width={width}
          height={height}
          currentView='dataset-selection'
          menuRef={menu => (this.setState({menu}))}
          menuVisible
          switchDataset={(dataset, nextMapping) => this._loadDataset(dataset,
            nextMapping)}
          toggleMenu={this.toggleMenu}
          activeDataset={activeDataset}
        />
        {gaze.active ? <div className={'gaze gaze-left'}/> : ''}
        {gaze.active ? <div className={'gaze gaze-right'}/> : ''}
        {gaze.active && gaze.target ? this._targetToString(gaze.target) : ''}
      </div>
    )
  }
}

const root = document.createElement('div')
root.id = 'root'
document.body.appendChild(root)

render(
  <Example/>,
  root
)
