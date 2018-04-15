/* eslint-disable no-undef,no-console */
import React, { createElement, cloneElement } from 'react'

export default class MenuLayer extends React.Component {
  /* static get propTypes() {
    return {
      name: PropTypes.string
    };
  }
  static get defaultProps() {
    return {
      name: 'Dean'
    };
  }*/
  constructor () {
    super()
    this.state = {
      menuStyle: {
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 64,
        width: '100%',
        height: '100%'
      },
      unitWidth: window.innerWidth / 2,
      unitHeight: window.innerHeight,
      currentView: null
    }
    this._getDatasetSelection = this._getDatasetSelection.bind(this)
    this._changeView = this._changeView.bind(this)
  }

  componentWillMount () {
    this._changeView(this.props.currentView)
  }

  _changeView (viewName) {
    if (!viewName) {
      this.setState({currentView: null})
      return
    }
    switch (viewName) {
      case 'dataset-selection':
        this.setState({currentView: this._getDatasetSelection()})
        break
      default:
        console.error('Cannot find view', viewName)
        break
    }
  }

  _getStereoscopicViews (element) {
    const {} = this.state
    const style = {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'none',
      width: '100%',
      height: '100%',
      position: 'relative',
      top: '0',
      left: '0'
    }
    const leftView = cloneElement(element)
    console.log(leftView)
    const rightViewStyle = Object.assign({}, leftView.props.style,
      {
        left: '50%'
      }
      )
    const rightView = cloneElement(element, {style: rightViewStyle})
    const viewContainer = createElement('div', {className: 'tint', style},
      leftView, rightView)
    return viewContainer
  }

  _getDatasetSelection () {
    const {unitWidth, unitHeight} = this.state
    const datasets = [
      {
        id: 0,
        name: 'DNA Molecule',
        description: 'Dataset of molecules'
      },
      {
        id: 1,
        name: 'World GDP',
        description: 'Country wise GDP, population etc.'
      },
      {
        id: 2,
        name: 'Indoor structure',
        description: 'Point cloud map of 3D indoor structure'
      }
    ]
    const style = {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignContent: 'center',
      position: 'absolute',
      color: '#fff',
      fontSize: '14px',
      left: 0,
      top: 0,
      width: '50%',
      height: '100%',
      alignItems: 'center'
    }
    const listItemStyle = {
      padding: '8px 16px'
    }
    const listItems = datasets.map(dataset => {
      return createElement('li', {key: dataset.id, style: listItemStyle},
        dataset.name)
    })
    const viewContainerStyle = {
      backgroundColor: 'rgba(17, 17, 17, 0.8)',
      height: 'fit-content'
    }
    const list = createElement('ul', {}, listItems)
    const viewContainer = createElement('div', {key: 'view', style: viewContainerStyle}, list)
    const htmlElement = createElement('div', {style}, viewContainer)
    return this._getStereoscopicViews(htmlElement)
  }

  render () {
    return <div classID='menu-layer' style={this.state.menuStyle}>
      {this.state.currentView ? this.state.currentView : ''}
    </div>
  }
}