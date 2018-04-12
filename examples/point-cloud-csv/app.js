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

import PlotLayer from './plot-layer'
import AxesLayer from './plot-layer/axes-layer'
import SurfaceLayer from './plot-layer/surface-layer'

import { Vector3, clamp } from 'math.gl'

import { scaleLinear } from 'd3-scale'

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
    this.buttonChangeHandler = this.buttonChangeHandler.bind(this)
    this.plotLayer = this.plotLayer.bind(this)
    this._onHover = this._onHover.bind(this)
    this._onClick = this._onClick.bind(this)
    this.setOrientation = this.setOrientation.bind(this)
    this.moveForward = this.moveForward.bind(this)
    // this._initVRDisplay = this._initVRDisplay.bind(this)

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
      vrDisplay: null,
      vrEnabled: false,
      emulatedPose: {
        orientation: [0, 0, 0, 1],
        position: [0, 0, 0],
        firstOrientation: null
      },
      hasGamepad: false,
      gamepad: {
        accelerationX: 0.0,
        accelerationY: 0.0,
        accelerationZ: 0.0
      },
      hasPosition: false,
    }
    window.instance = this
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

  moveForward (step) {
    const {orientation, position} = this.state.emulatedPose

    const positionVector = new Vector3(...position)

    step = step || 0.1

    console.log('positionVector', positionVector.toString())
    console.log('positionVector.add', positionVector)

    // this.setState({
    //   ...emulatedPose,
    // })
    return positionVector
  }

  componentWillMount () {
    window.addEventListener('resize', this._onResize)
    this._onResize()
  }

  componentDidMount () {
    const {points} = this.state

    const url = './datasets/3.csv'
    const colors = [
      [0, 176, 240],
      [255, 0, 0],
      [255, 192, 0],
      [255, 255, 0],
      [0, 255, 0]]

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
        const size = 3
        const r = 4
        const g = 5
        const b = 6
        const type = headers.length - 1

        for (let i = 1; i < data.length; i++) {
          const point = data[i]
          const color = [point[r] * 255, point[g] * 255, point[b] * 255].concat(
            [point[size]])
          const position = [point[x], point[y], point[z]]
          // const color = colors[Math.round(point[type]) % colors.length].concat([255])
          // console.log(color);
          points.push({color, position, size: point[size]})
        }

        normalize(points)

        this.setState({points, progress: 1})
      }
    })

    /**
     * Gets the rotation axis and angle for a given
     *  quaternion. If a quaternion is created with
     *  setAxisAngle, this method will return the same
     *  values as providied in the original parameter list
     *  OR functionally equivalent values.
     * Example: The quaternion formed by axis [0, 0, 1] and
     *  angle -90 is the same as the quaternion formed by
     *  [0, 0, 1] and 270. This method favors the latter.
     * @param  {vec3} out_axis  Vector receiving the axis of rotation
     * @param  {quat} q     Quaternion to be decomposed
     * @return {Number}     Angle, in radians, of the rotation
     */
    function getAxisAngle (out_axis, q) {
      const rad = Math.acos(q[3]) * 2.0
      const s = Math.sin(rad / 2.0)
      if (s != 0.0) {
        out_axis[0] = q[0] / s
        out_axis[1] = q[1] / s
        out_axis[2] = q[2] / s
      } else {
        // If s is zero, return any axis (no rotation - axis does not matter)
        out_axis[0] = 1
        out_axis[1] = 0
        out_axis[2] = 0
      }
      return rad
    }

    const {firstOrientation, orientation, position} = this.state.emulatedPose
    // setInterval(() => {
    //   console.group()
    //   //console.log('orig:', quatToAngle(this.state.emulatedPose.firstOrientation))
    //   //console.log('_now:', quatToAngle(this.state.emulatedPose.orientation))
    //   // console.log('diff:', quatToAngle(difference(this.state.emulatedPose.firstOrientation, this.state.emulatedPose.orientation)))
    //   console.log('position', this.state.emulatedPose.position);
    //   console.groupEnd()
    // }, 1000)

    function difference (a, b) {
      a = Array.from(a)
      b = Array.from(b)
      return [
        a[0] - b[0],
        a[1] - b[1],
        a[2] - b[2],
        a[3] - b[3]]
    }

    function quatToAngle (a) {
      if (a) {
        if (a instanceof Float32Array) {
          a = Array.from(a)
        }
        const o = [0, 0, 0, 0]
        const e = Euler.fromQuaternion(a, 'XYZ')
        out = [e.x, e.y, e.z, 0]
        //getAxisAngle(o, a);
        return e.map(v => v * 180 / Math.PI)
      }

    }

    function _quatToAngle (a) {
      if (a) {
        if (a instanceof Float32Array) {
          a = Array.from(a)
        }
        const [qx, qy, qz, qw] = a

        const angle = 2.0 * Math.acos(qw)
        console.log('angle', Math.acos(qw), qw)
        const x = qx / Math.sqrt(1 - qw * qw)
        const y = qy / Math.sqrt(1 - qw * qw)
        const z = qz / Math.sqrt(1 - qw * qw)
        console.log('Math.sqrt(1 - qw * qw)', Math.sqrt(((1 - qw) * qw)),
          ((1 - qw) * qw))
        return [x, y, z, angle]
      }

    }

    this._initVRDisplay()
    // window.requestAnimationFrame(this._onUpdate)
    // this.forceUpdate();
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
    console.log(axisName, value)
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
      // clearColor: [0.01, 0.01, 0.04, 1]
      clearColor: [0.07, 0.14, 0.19, 1]
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
      // getSize: d => d.size,
      getNormal: d => {
        return [1, 1, 1]
      },
      // getColor: d => [255, 255, 255, 128],
      radiusPixels: useSmallRadius ? 10 : 10,
      pickable: true
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
          const {hasPosition} = vrDisplay.capabilities;
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
      //} else if (hasPosition) {
      //  gotFrameData = vrDisplay.getFrameData(frameData)
    } else {
      const newFrameData = new window.VRFrameData()
      vrDisplay.getFrameData(newFrameData)
      const {orientation} = newFrameData.pose
      gotFrameData = vrDisplay.getFrameData(frameData)
//      console.log('gotFrameData', gotFrameData)
      const emulatedDisplay = new EmulatedVRDisplay()
      emulatedPose.orientation = orientation
      gotFrameData = emulatedDisplay.getFrameDataFromPose(frameData,
      emulatedPose)
    }
    if (!emulatedPose.firstOrientation) {
      emulatedPose.firstOrientation = Array.from(emulatedPose.orientation)
      console.log('First Orientation:', emulatedPose.firstOrientation)
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

  plotLayer () {
    const {points} = this.state
    const equation = (x, y) => Math.sin(x * x + y * y) * x / Math.PI

    function getScale ({min, max}) {
      return scaleLinear().domain([min, max]).range([-0.5, 0.5])
    }

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
      onClick: this._onClick
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
          layers={[this.plotLayer(), this._renderCsvPointCloudLayer(true)]}
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
          layers={[this.plotLayer(), this._renderCsvPointCloudLayer(true)]}
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
                onButtonChange={this.buttonChangeHandler}
              >
                <div/>
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
    const offLimits = 0.7
    if (vrEnabled && hasGamepad && !hasPosition) {
      if (gamepad.accelerationX > 0) {
        if (position[0] < offLimits) {
          position[0] += gamepad.accelerationX
        }
      } else if (gamepad.accelerationX < 0) {
        if (position[0] > -offLimits) {
          position[0] += gamepad.accelerationX
        }
      }
      if (gamepad.accelerationY > 0) {
        if (position[1] < offLimits) {
          position[1] += gamepad.accelerationY
        }
      } else if (gamepad.accelerationY < 0) {
        if (position[1] > -offLimits) {
          position[1] += gamepad.accelerationY
        }
      }
      if (gamepad.accelerationZ > 0) {
        if (position[2] < offLimits) {
          position[2] += gamepad.accelerationZ
        }
      } else if (gamepad.accelerationZ < 0) {
        if (position[2] > -offLimits) {
          position[2] += gamepad.accelerationZ
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
