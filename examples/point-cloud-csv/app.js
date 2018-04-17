/* global document, window, navigator */
/* eslint-disable no-console,no-undef */
import React, { PureComponent } from 'react'
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
import { Gamepad } from 'react-gamepad'

import PlotLayer from './plot-layer'
import Quaternion from './math/Quaternion'
import Transform from './math/Transform'
import Vec3 from './math/Vec3'
import { datasets } from './datasets'

import { scaleLinear, scaleLog } from 'd3-scale'

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
    //  this._initVRDisplay = this._initVRDisplay.bind(this)

    this.state = {
      width: 0,
      height: 0,
      points: [],
      progress: 0,
      rotating: false,
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
      vrViewports: this.getDefaultViewport(100, 100),
      menuVisible: false,
      datasets,
      activeDataset: datasets[0],
      scales: {}
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

  _loadDataset (dataset = this.state.activeDataset) {
    const {_getPoints: getPoints} = this
    if (!dataset) {
      console.error('Dataset is null.')
      return
    }
    getPoints(dataset, (points) => {
      this.setState({points, progress: 1, activeDataset: dataset})
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
        break
      default:
        break
    }
  }

  _parseCSV (csv, dataset) {
    const {data} = csv
    const {meta} = dataset
    const {mapping, range} = meta
    const {x, y, z, s, r, g, b, t, i} = mapping
    const {_getScale: getScale, _getLimits: getLimits} = this
    const {xLimit, yLimit, zLimit, sLimit, bLimit} = getLimits(data, mapping)
    const colorMultiplier = bLimit.max > 2 ? 1.0 : 255
    const scaleRange = range.s || [sLimit.min, sLimit.max]
    const points = []
    const max = Math.max(...Object.values(mapping)) + 1

    for (let idx = 1; idx < data.length; idx++) {
      const d = data[idx]
      const point = {}

      point.position = [
        getScale(xLimit)(d[x]),
        getScale(yLimit)(d[y]),
        getScale(zLimit)(d[z])
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
        point.time = d[i]
      }

      points.push(point)
    }
    return points
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

    console.log('getLimits', x, y, z, data)

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

  buttonChangeHandler (buttonName, down) {
    const {emulatedPose, menu} = this.state
    console.log(buttonName, down)
    switch (buttonName) {
      case 'Y':
        if (down) {
          this.setState({menuVisible: !this.state.menuVisible})
        }
        break
      case 'A':
        if(down) {
          menu.navigate().press()
        }
        break
      case 'RS':
        if (down) {
          emulatedPose.position = [0, 0, 0]
        }
        break
      case 'DPadUp':
        if (down) {
          menu.navigate().up()
        }
        break
      case 'DPadDown':
        if (down) {
          menu.navigate().down()
        }
        break
      case 'DPadLeft':
        if (down) {
          menu.navigate().left()
        }
        break
      case 'DPadRight':
        if (down) {
          menu.navigate().right()
        }
        break
    }
  }

  axisChangeHandler (axisName, value, previousValue) {
    const {gamepad} = this.state
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
  }

  _onViewportChange (viewport) {
    this.setState({
      // rotating: !viewport.isDragging,
      viewport: {...this.state.viewport, ...viewport}
    })
  }

  _onUpdate () {
    this.forceUpdate() // explicitly refresh state; removing this breaks frame update in VR
    window.requestAnimationFrame(this._onUpdate)
  }

  _renderCsvPointCloudLayer () {
    const {points} = this.state
    if (!points || points.length === 0) {
      return null
    }

    return new PointCloudLayer({
      id: 'laz-point-cloud-layer',
      data: points,
      coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
      getPosition: d => d.position,
      // getSize: d => d.size,
      getNormal: d => d.position.map(Math.abs).map(Math.sqrt),
      // getColor: d => [255, 255, 255, 128],
      radiusPixels: 10,
      pickable: true
    })
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
    const {points} = this.state

    return new PlotLayer({
      getColor: (x, y, z) => [40, z * 128 + 128, 160, 128],
      getXScale: getScale,
      getYScale: getScale,
      getZScale: getScale,
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
      xTitle: 'GDP',
      yTitle: 'Life Expectancy',
      zTitle: 'Population',
      xTickFormat: x => (x.toFixed(2)),
      labelHidden: false
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
    const {width, height, viewport, vrEnabled, hoverInfo} = this.state

    if (vrEnabled) {
      return (
        <DeckGL
          width={width}
          height={height}
          viewports={this._renderViewports()}
          layers={[this.plotLayer(), this._renderCsvPointCloudLayer()]}
          onWebGLInitialized={this._onInitialized}
          onLayerClick={this._onClick}
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
          layers={[this.plotLayer(), this._renderCsvPointCloudLayer()]}
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
      return position.map(this.limitTo(2))
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

  render () {
    const {width, height, menuVisible} = this.state
    if (width <= 0 || height <= 0) {
      return null
    }

    return (
      <div
        className={!menuVisible ? 'menu-layer--visible' : 'menu-layer--hidden'}>
        {this._renderDeckGLCanvas()}
        {this._renderProgressInfo()}
        <MenuLayer
          datasets={datasets}
          width={width}
          height={height}
          currentView='dataset-selection'
          menuRef={menu => (this.setState({menu}))}
          menuVisible
          switchDataset={dataset => this._loadDataset(dataset)}
          toggleMenu={() => this.setState({menuVisible: !this.state.menuVisible})}
        />
      </div>
    )
  }
}

const root = document.createElement('div')
root.id = 'root'
document.body.appendChild(root)

render(<Example/>, root)
