/* eslint-disable no-undef,no-console */
import React, { createElement, cloneElement } from 'react'

export default class MenuLayer extends React.Component {
  constructor () {
    super()
    this.state = {
      menu: React.createRef(),
      menuStyle: {
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 64,
        width: '100%',
        height: '100%'
      },
      stereoscopicOffset: 4,
      unitWidth: window.innerWidth / 2,
      unitHeight: window.innerHeight,
      currentView: null,
      currentViewName: null,
      traversables: [],
      focus: {x: 0, y: -1}
    }
    this._getDatasetSelection = this._getDatasetSelection.bind(this)
    this._changeView = this._changeView.bind(this)
    this._updateView = this._updateView.bind(this)
    this._findFocus = this._findFocus.bind(this)
    this._handleAction = this._handleAction.bind(this)
  }

  componentWillMount () {}

  componentDidMount () {
    this._changeView(this.props.currentView)
    this.props.menuRef(this)
  }

  componentWillUnmount () {
    this.props.menuRef(undefined)
  }

  _changeView (viewName) {
    if (!viewName) {
      this.setState({currentView: null})
      return
    }
    switch (viewName) {
      case 'dataset-selection':
        this.setState({
          currentViewName: viewName,
          currentView: this._getDatasetSelection()
        })
        break
      default:
        console.error('Cannot find view', viewName)
        break
    }
  }

  _updateView () {
    const {currentViewName} = this.state
    this._changeView(currentViewName)
  }

  _getStereoscopicViews (element) {
    const leftView = cloneElement(element,
      {className: 'stereoscopic-view-left'})
    const rightView = cloneElement(element,
      {className: 'stereoscopic-view-right'})
    return createElement('div', {className: 'stereoscopic-view-container'},
      leftView, rightView)
  }

  _getDatasetSelection () {
    const {datasets} = this.props

    const listItems = datasets.map(dataset => {
        const title = createElement('div',
          {className: 'dataset-list-item--title'}, dataset.name)
        const desc = createElement('div',
          {className: 'dataset-list-item--description'}, dataset.description)
        const classes = `dataset-list-item menu-traversable ${dataset.focused
          ? 'menu-focus'
          : ''}`
        return createElement('div',
          {className: classes, key: dataset.id},
          title,
          desc)
      }
    )
    const traversables = [datasets.map(dataset => {
      dataset.action = 'switch-dataset'
      return dataset
    })]
    this.setState({traversables})
    const list = createElement('div',
      {className: 'dataset-list menu-traversable-list'}, listItems)
    const viewContainer = createElement('div', {className: 'view-container'},
      list)
    const htmlElement = createElement('div', {className: 'view-element'},
      viewContainer)
    return this._getStereoscopicViews(htmlElement)
  }

  _updateFocus (x, y) {
    const {traversables, focus} = this.state
    if (traversables[x] && traversables[x][y]) {
      if (traversables[focus.x][focus.y]) {
        traversables[focus.x][focus.y].focused = false
        focus.x = focus.y = null
      }
      traversables[x][y].focused = true
      focus.x = x
      focus.y = y
      this._updateView()
    }
  }

  _findFocus() {
    const {traversables, focus} = this.state;
    for (let i = 0; i < traversables.length; i++) {
      for (let j = 0; j < traversables[i].length; j++) {
        if (traversables[i][j].focused) {
          focus.x = i
          focus.y = j
          return;
        }
      }
    }
  }

  _handleAction(object) {
    const { switchDataset, toggleMenu } = this.props
    switch(object.action) {
      case 'switch-dataset':
        switchDataset(object);
        toggleMenu();
        break;
      default:
        break
    }
  }

  navigate () {
    const {traversables, focus} = this.state
    const {menuVisible} = this.props
    if (!menuVisible) {
      return
    }
    if (focus.x === null || focus.y === null) {
      this._findFocus();
    }
    const {x, y} = focus
    return {
      up: () => {
        if (traversables[x] && traversables[x][y - 1])
          this._updateFocus(x, y - 1)
        else if (traversables[x] && traversables[x][traversables[x].length - 1])
          this._updateFocus(x, traversables[x].length - 1)
      },
      down: () => {
        if (traversables[x] && traversables[x][y + 1])
          this._updateFocus(x, y + 1)
        else if (traversables[x] && traversables[x][0])
          this._updateFocus(x, 0)
      },
      left: () => {
        if (traversables[x - 1] && traversables[x - 1][y])
          this._updateFocus(x - 1, y)
      },
      right: () => {
        if (traversables[x] && traversables[x][y])
          this._updateFocus(x + 1, y)
        else if (traversables[0] && traversables[0][y])
          this._updateFocus(0, y)
      },
      press: () => {
        const object = traversables[focus.x][focus.y]
        if(object) {
          this._handleAction(object)
        }
      }
    }
  }

  render () {
    return <div id='menu-layer' style={this.state.menuStyle}
                ref={this.state.menu}>
      {this.state.currentView ? this.state.currentView : ''}
    </div>
  }
}