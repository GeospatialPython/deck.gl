/* eslint-disable no-undef,no-console */
/* global window,document */
import React, {Component} from 'react';
import {render} from 'react-dom';
import {experimental, Viewport} from 'deck.gl';

import DeckGLOverlay from './deckgl-overlay.js';

import WebVRPolyfill from 'webvr-polyfill';
import EmulatedVRDisplay from './vr/emulated-vr-display';

import {Gamepad} from 'react-gamepad';

const {OrbitController} = experimental;
const EQUATION = (x, y) => (Math.sin(x * 4 + y * y) * x / Math.PI) * 0;

class Root extends Component {
  constructor(props) {
    super(props);
    this.state = {
      viewport: {
        lookAt: [0, 0, 0],
        distance: 3,
        rotationX: -30,
        rotationOrbit: 30,
        orbitAxis: 'Y',
        fov: 50,
        minDistance: 1,
        maxDistance: 20,
        width: 500,
        height: 500
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
    };
    // this._resize = this._resize.bind(this);
    this._onViewportChange = this._onViewportChange.bind(this);
    this._onHover = this._onHover.bind(this);
    this.positionLoop = this.positionLoop.bind(this);
    this.axisChangeHandler = this.axisChangeHandler.bind(this);
    this.connectHandler = this.connectHandler.bind(this);
    this.disconnectHandler = this.disconnectHandler.bind(this);
    this.buttonChangeHandler = this.buttonChangeHandler.bind(this);
  }

  componentDidMount() {
    window.addEventListener('resize', this._resize);
    this._resize();
    this._initVRDisplay();
    window.requestAnimationFrame(this.positionLoop);
  }

  connectHandler(gamepadIndex) {
    console.log(`Gamepad ${gamepadIndex} connected !`);
    this.setState({
      hasGamepad: true
    });
  }

  disconnectHandler(gamepadIndex) {
    console.log(`Gamepad ${gamepadIndex} disconnected !`);
    this.setState({
      hasGamepad: false
    });
  }

  buttonChangeHandler(buttonName, down) {
    console.log(buttonName, down);
  }

  axisChangeHandler(axisName, value, previousValue) {
    const {gamepad} = this.state;
    const inc = 0.01;
    console.log(axisName, value);
    switch (axisName) {
      case 'LeftStickX':
        if (value !== 0) {
          gamepad.accelerationX += inc * value;
        } else {
          gamepad.accelerationX = 0;
        }
        break;
      case 'LeftStickY':
        if (value !== 0) {
          gamepad.accelerationY += inc * value;
        } else {
          gamepad.accelerationY = 0;
        }
        break;
    }
    this.setState({
      gamepad
    });
  }

  _resize() {
    const size = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    const newViewport = OrbitController.getViewport(
      Object.assign(this.state.viewport, size)
    ).fitBounds([3, 3, 3]);

    this._onViewportChange(newViewport);
  }

  _onViewportChange(viewport) {
    Object.assign(this.state.viewport, viewport);
    this.setState({viewport: this.state.viewport});
  }

  _onHover(info) {
    const hoverInfo = info.sample ? info : null;
    if (hoverInfo !== this.state.hoverInfo) {
      this.setState({hoverInfo});
    }
  }

  _initVRDisplay() {
    /* eslint-disable no-unused-vars */
    const polyfill = new WebVRPolyfill({
      PROVIDE_MOBILE_VRDISPLAY: true
    });
    /* eslint-disable no-unused-vars */

    if (navigator && navigator.getVRDisplays) {
      navigator.getVRDisplays().then(displays => {
        const vrDisplay = displays[0];
        if (vrDisplay) {
          const {hasPosition} = vrDisplay.capabilities;
          this.setState({vrDisplay, vrEnabled: true, hasPosition});
        }
      });
    }
  }

  _renderViewports() {
    const {width, height, vrDisplay, emulatedPose, hasPosition} = this.state;
    const frameData = vrDisplay.isEmulated ? {} : new window.VRFrameData();
    let gotFrameData = false;
    if (vrDisplay.isEmulated) {
      gotFrameData = vrDisplay.getFrameDataFromPose(frameData, emulatedPose);
    } else {
      if (hasPosition) {
        gotFrameData = vrDisplay.getFrameData(frameData);
      } else {
        const newFrameData = new window.VRFrameData();
        vrDisplay.getFrameData(newFrameData);
        const {orientation} = newFrameData.pose;
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
      ];
    }
    return new Viewport({width, height});
  }

  _renderProgressInfo() {
    const progress = (this.state.progress * 100).toFixed(2);
    return (
      <div>
        <div
          style={{
            position: 'absolute',
            left: '8px',
            bottom: '8px',
            color: '#111',
            fontSize: '15px'
          }}
        >
          {this.state.progress < 1 ? (
            <div>
              <div>This example might not work on mobile devices due to browser limitations.</div>
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
            color: '#111',
            fontSize: '15px'
          }}
        >
          {this.state.vrEnabled ? (
            <div>
              {this.state.vrDisplay.isEmulated ? (
                <a onClick={this._toggleDisplayMode.bind(this)}>Exit stereoscopic view.</a>
              ) : (
                <br />
              )}
              <Gamepad
                onConnect={this.connectHandler}
                onDisconnect={this.disconnectHandler}
                onAxisChange={this.axisChangeHandler}
                onButtonChange={this.buttonChangeHandler}
              >
                <div>Hi there</div>
              </Gamepad>
            </div>
          ) : (
            <div>
              <div>No VR Device found.</div>
              <a onClick={this._toggleDisplayMode.bind(this)}>Enter stereoscopic view.</a>
            </div>
          )}
        </div>
      </div>
    );
  }

  positionLoop() {
    const {emulatedPose, vrEnabled, hasGamepad, hasPosition, gamepad} = this.state;
    const {position, orientation} = emulatedPose;
    const offLimits = 0.7;
    if (vrEnabled && hasGamepad && !hasPosition) {
      if (gamepad.accelerationX > 0) {
        if (position[0] < offLimits) {
          position[0] += gamepad.accelerationX;
        }
      } else if (gamepad.accelerationX < 0) {
        if (position[0] > -offLimits) {
          position[0] += gamepad.accelerationX;
        }
      }
      if (gamepad.accelerationY > 0) {
        if (position[1] < offLimits) {
          position[1] += gamepad.accelerationY;
        }
      } else if (gamepad.accelerationY < 0) {
        if (position[1] > -offLimits) {
          position[1] += gamepad.accelerationY;
        }
      }
      if (gamepad.accelerationZ > 0) {
        if (position[2] < offLimits) {
          position[2] += gamepad.accelerationZ;
        }
      } else if (gamepad.accelerationZ < 0) {
        if (position[2] > -offLimits) {
          position[2] += gamepad.accelerationZ;
        }
      }

      this.setState({
        emulatedPose: {
          ...emulatedPose,
          ...position
        }
      });
    }
    this.forceUpdate();
    requestAnimationFrame(this.positionLoop);
  }

  render() {
    const {viewport, hoverInfo} = this.state;

    return (<DeckGLOverlay
      viewport={viewport}
      viewports={this._renderViewports()}
      equation={EQUATION}
      resolution={200}
      showAxis={true}
      onHover={this._onHover}
      onClick={info => console.log('>>', info)}
    />);

    return (
      <OrbitController {...viewport} onViewportChange={this._onViewportChange}>
        <DeckGLOverlay
          viewport={viewport}
          viewports={this._renderViewports()}
          equation={EQUATION}
          resolution={200}
          showAxis={true}
          onHover={this._onHover}
        />

        {hoverInfo && (
          <div className="tooltip" style={{left: hoverInfo.x, top: hoverInfo.y}}>
            {hoverInfo.sample.map(x => x.toFixed(3)).join(', ')}
          </div>
        )}
      </OrbitController>
    );
  }
}

render(<Root />, document.body.appendChild(document.createElement('div')));
