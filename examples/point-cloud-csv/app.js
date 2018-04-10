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

import WebVRPolyfill from 'webvr-polyfill'
import EmulatedVRDisplay from './vr/emulated-vr-display'

import Papa from 'papaparse'
import { Gamepad } from 'react-gamepad'

const DATA_REPO = 'https://raw.githubusercontent.com/uber-common/deck.gl-data/master'
const FILE_PATH = 'examples/point-cloud-laz/indoor.laz'

function normalize (points) {
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

class Example extends PureComponent {
  constructor (props) {
    super(props)

    this._onViewportChange = this._onViewportChange.bind(this)
    this._onInitialized = this._onInitialized.bind(this)
    this._onResize = this._onResize.bind(this)
    this._onUpdate = this._onUpdate.bind(this)
    this.positionLoop = this.positionLoop.bind(this)
    this.axisChangeHandler = this.axisChangeHandler.bind(this)
    this.connectHandler = this.connectHandler.bind(this)
    this.disconnectHandler = this.disconnectHandler.bind(this)

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
      emulatedPose: {
        orientation: [0, 0, 0, 1],
        position: [0, 0, 0]
      },
      hasGamepad: false,
      gamepad: {
        accelerationX: 0.0,
        accelerationY: 0.0,
        accelerationZ: 0.0
      },
      hasPosition: false
    }
  }

  componentWillMount () {
    window.addEventListener('resize', this._onResize)
    this._onResize()
  }

  componentDidMount () {
    const {points} = this.state

    const url = './datasets/3.csv'
    const colors = [
      [
        0,
        176,
        240],
      [
        255,
        0,
        0],
      [
        255,
        192,
        0],
      [
        255,
        255,
        0],
      [
        0,
        255,
        0]]

    const attributePreferences = {
      x: ['x', '"x"', '\'x\''],
      y: ['y', '"y"', '\'y\''],
      z: ['z', '"z"', '\'z\'']
    }

    Papa.parse(url, {
      download: true,
      complete: csv => {
        const data = csv.data
        const headers = data[0]

        const x = 0
        const y = 1
        const z = 2
        const r = 4
        const g = 5
        const b = 6
        const type = headers.length - 1

        for (let i = 1; i < data.length; i++) {
          const point = data[i]
          const color = [point[r] * 255, point[g] * 255, point[b] * 255].concat(
            [255])
          const position = [point[x], point[y], point[z]]
          // const color = colors[Math.round(point[type]) % colors.length].concat([255])
          // console.log(color);
          points.push({color, position})
        }

        normalize(points)

        this.setState({points, progress: 1})
      }
    })

    this._initVRDisplay()
    // window.requestAnimationFrame(this._onUpdate)
    window.requestAnimationFrame(this.positionLoop)
  }

  connectHandler (gamepadIndex) {
    console.log(`Gamepad ${gamepadIndex} connected !`)
    this.setState({
      hasGamepad: true
    })
  }

  disconnectHandler (gamepadIndex) {
    console.log(`Gamepad ${gamepadIndex} disconnected !`)
    this.setState({
      hasGamepad: false
    })
  }

  buttonChangeHandler (buttonName, down) {
    console.log(buttonName, down)
  }

  axisChangeHandler (axisName, value, previousValue) {
    const {gamepad} = this.state
    const inc = 0.01
    switch (axisName) {
      case 'LeftStickX':
        if (value !== 0) {
          gamepad.accelerationX += inc * value
        } else {
          gamepad.accelerationX = 0
        }
        break
      case 'LeftStickY':
        if (value !== 0) {
          gamepad.accelerationY += inc * value
        } else {
          gamepad.accelerationY = 0
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
      clearColor: [0.01, 0.01, 0.04, 1]
      // clearColor: [0.07, 0.14, 0.19, 1],
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
    const {vrEnabled} = this.state

    if (vrEnabled) {
      const {vrDisplay, emulatedPose} = this.state
      // animate camera in Z-axis
      // this can be removed after we have a VRController for EmulatedVRDisplay
      if (vrDisplay.isEmulated) {
        const {position} = emulatedPose
        position[2] += position[2] < 1 ? 0.001 : -1
        this.setState({
          emulatedPose: {
            ...emulatedPose,
            ...position
          }
        })
      }
      window.vrDisplay = vrDisplay

      this.forceUpdate() // explicitly refresh state; removing this breaks frame update in VR
      window.requestAnimationFrame(this._onUpdate)
      return
    }

    const {rotating, viewport} = this.state
    // note: when finished dragging, _onUpdate will not resume by default
    // to resume rotating, explicitly call _onUpdate or requestAnimationFrame
    if (!rotating) {
      return
    }

    this.setState({
      viewport: {
        ...viewport,
        rotationOrbit: viewport.rotationOrbit + 1
      }
    })

    window.requestAnimationFrame(this._onUpdate)
  }

  _renderCsvPointCloudLayer (useSmallRadius = false) {
    const {points} = this.state
    if (!points || points.length === 0) {
      return null
    }

    return new PointCloudLayer({
      id: 'laz-point-cloud-layer',
      data: points,
      coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
      getPosition: d => d.position,
      getNormal: d => [1, 1, 1],
      // getColor: d => [255, 255, 255, 128],
      radiusPixels: useSmallRadius ? 4 : 10
    })
  }

  _initVRDisplay () {
    /* eslint-disable no-unused-vars */
    const polyfill = new WebVRPolyfill({
      PROVIDE_MOBILE_VRDISPLAY: true
    })
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
    const {width, height, vrDisplay, emulatedPose, hasPosition} = this.state
    const frameData = vrDisplay.isEmulated ? {} : new window.VRFrameData()
    let gotFrameData = false
    if (vrDisplay.isEmulated) {
      gotFrameData = vrDisplay.getFrameDataFromPose(frameData, emulatedPose)
    } else {
      if (hasPosition) {
        gotFrameData = vrDisplay.getFrameData(frameData)
      } else {
        const newFrameData = new window.VRFrameData();
        vrDisplay.getFrameData(newFrameData)
        const { orientation } = newFrameData.pose;
        gotFrameData = vrDisplay.getFrameData(newFrameData);
        const emulatedDisplay = new EmulatedVRDisplay();
        emulatedPose.orientation = orientation;
        gotFrameData = emulatedDisplay.getFrameDataFromPose(frameData, emulatedPose);
      }
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
    return new Viewport({width, height})
  }

  _toggleDisplayMode () {
    const {vrEnabled} = this.state

    this.setState({
      vrEnabled: !vrEnabled
    })
  }

  _renderDeckGLCanvas () {
    const {width, height, viewport, vrEnabled} = this.state

    if (vrEnabled) {
      return (
        <DeckGL
          width={width}
          height={height}
          viewports={this._renderViewports()}
          layers={[this._renderCsvPointCloudLayer(true)]}
          onWebGLInitialized={this._onInitialized}
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
          layers={[this._renderCsvPointCloudLayer()]}
          onWebGLInitialized={this._onInitialized}
        />
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
              <div>This example might not work on mobile devices due to browser
                limitations.
              </div>
              <div>Please try checking it with a desktop machine instead.</div>
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
              <Gamepad
                onConnect={this.connectHandler}
                onDisconnect={this.disconnectHandler}
                onAxisChange={this.axisChangeHandler}
              >
                <div>Hi there</div>
              </Gamepad>
            </div>
          ) : (
            <div>
              <div>No VR Device found.</div>
              <a onClick={this._toggleDisplayMode.bind(this)}>Enter stereoscopic
                view.</a>
            </div>
          )}
        </div>
      </div>
    )
  }

  positionLoop () {
    const {emulatedPose, vrEnabled, hasGamepad, hasPosition, gamepad} = this.state
    const {position, orientation} = emulatedPose
    const offLimits = 0.7;
    if (vrEnabled && hasGamepad && !hasPosition) {

      if(gamepad.accelerationX > 0) {
        if (position[0] < offLimits) {
          position[0] += gamepad.accelerationX
        }
      } else if (gamepad.accelerationX < 0) {
        if (position[0] > -offLimits) {
          position[0] += gamepad.accelerationX
        }
      }
      if(gamepad.accelerationY > 0) {
        if (position[1] < offLimits) {
          position[1] += gamepad.accelerationY
        }
      } else if (gamepad.accelerationY < 0) {
        if (position[1] > -offLimits) {
          position[1] += gamepad.accelerationY
        }
      }

      this.setState({
        emulatedPose: {
          ...emulatedPose,
          ...position
        }
      })
    }
    this.forceUpdate()
    requestAnimationFrame(this.positionLoop)
  }

  render () {
    const {width, height} = this.state
    if (width <= 0 || height <= 0) {
      return null
    }


    return (
      <div>
        {this._renderDeckGLCanvas()}
        {this._renderProgressInfo()}
      </div>
    )
  }
}

const root = document.createElement('div')
document.body.appendChild(root)

render(<Example/>, root)
