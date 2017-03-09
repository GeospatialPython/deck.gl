/* global window */
import {GL} from 'luma.gl';
import React, {Component} from 'react';
import DeckGL, {ScatterplotLayer} from 'deck.gl';

import WindLayer from './wind-layer/wind-layer';
import DelaunayCoverLayer from './wind-layer/delaunay-cover-layer';
import ParticleLayer from './wind-layer/particle-layer';
import {loadData} from './utils/load-data';

import TWEEN from 'tween.js';

export default class WindDemo extends Component {

  constructor(props) {
    super(props);

    this.state = {
      data: null
    };

    const particalState = {particalTime: 0};
    this._particalAnimation = new TWEEN.Tween(particalState)
      .to({particalTime: 60}, 1000)
      .onUpdate(() => this.setState(particalState))
      .repeat(Infinity);
  }

  componentDidMount() {
    loadData().then(data => this.setState({data}));

    if (this.props.params.toggleParticles) {
      this._particalAnimation.start();
    }
  }

  componentWillReceiveProps(nextProps) {
    const {params: {toggleParticles}} = nextProps;
    if (this.props.params.toggleParticles !== toggleParticles) {
      if (toggleParticles) {
        this._particalAnimation.start();
      } else {
        this._particalAnimation.stop();
      }
    }
  }

  componentWillUnmount() {
    this._particalAnimation.stop();
  }

  render() {
    const {viewport, params} = this.props;
    const {data} = this.state;

    if (!data) {
      return null;
    }

    const {stations, weather, triangulation, texData, bbox} = data;

    const layers = [
      new ScatterplotLayer({
        id: 'stations',
        data: stations,
        getPosition: d => [-d.long, d.lat, +d.elv],
        getColor: d => [200, 200, 100],
        getRadius: d => 150,
        opacity: 0.2
      }),
      params.toggleParticles && new ParticleLayer({
        id: 'particles',
        bbox,
        texData,
        time: params.time
      }),
      params.toggleWind && new WindLayer({
        id: 'wind',
        bbox,
        texData,
        time: params.time
      }),
      params.toggleElevation && new DelaunayCoverLayer({
        id: 'delaunay-cover',
        triangulation
      })
    ].filter(Boolean);

    return (
      <DeckGL glOptions={{webgl2: true}}
        {...viewport}
        layers={ layers } />
    );
  }

}