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
      views: ['dataset-selection', 'attribute-assignment'],
      focus: {x: 0, y: -1},
      nextMapping: null,
      mappingAttributes: null
    }
    this._getDatasetSelection = this._getDatasetSelection.bind(this)
    this._getAttributeAssignment = this._getAttributeAssignment.bind(this)
    this._buildMappingAttributes = this._buildMappingAttributes.bind(this)
    this._changeView = this._changeView.bind(this)
    this._updateView = this._updateView.bind(this)
    this._findFocus = this._findFocus.bind(this)
    this._handleAction = this._handleAction.bind(this)
    this._nextView = this._nextView.bind(this)
    this._previousView = this._previousView.bind(this)
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
      case 'attribute-assignment':
        this.setState({
          currentViewName: viewName,
          currentView: this._getAttributeAssignment()
        })
        break
      default:
        console.error('Cannot find view', viewName)
        break
    }
  }

  _nextView () {
    const {currentViewName, views} = this.state
    if (currentViewName !== null) {
      const nextIndex = views.indexOf(currentViewName) + 1
      if (nextIndex < views.length) {
        const nextViewName = views[nextIndex]
        this._changeView(nextViewName)
      }
    }
  }

  _previousView () {
    const {currentViewName, views} = this.state
    if (currentViewName !== null) {
      const nextIndex = views.indexOf(currentViewName) - 1
      if (nextIndex >= 0) {
        const nextViewName = views[nextIndex]
        this._changeView(nextViewName)
      }
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
    const traversables = [
      datasets.map(dataset => {
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

  _getAttributeAssignment () {
    const {activeDataset} = this.props
    const {labels, mapping} = activeDataset.meta
    const maps = [
      {
        name: 'X-axis',
        key: 'x'
      },
      {
        name: 'Y-axis',
        key: 'y'
      },
      {
        name: 'Z-axis',
        key: 'z'
      },
      {
        name: 'Size',
        key: 's'
      }]

    let {nextMapping} = this.state
    if (!nextMapping) {
      nextMapping = Object.assign({}, mapping)
      this.setState({nextMapping})
    }

    let {mappingAttributes} = this.state
    if (!mappingAttributes) {
      mappingAttributes = this._buildMappingAttributes(nextMapping, maps, labels)
    }

    const attributeSets = []
    for (let i = 0; i < mappingAttributes.length; i++) {
      const attributeName =
        createElement('div', {className: 'attribute-name'}, maps[i].name)
      attributeSets.push(attributeName)
      const attributes = mappingAttributes[i]
      const labelItems = attributes.map(attribute => {
        return createElement('div', {
          key: attribute.key,
          className: `attribute-label ${attribute.visible
            ? 'attribute-label--visible'
            : ''} ${attribute.focused ? 'menu-focus': ''}`
        }, attribute.label)
      })
      const attributeLabelGroup =
        createElement('div', {className: 'attribute-set', key: i}, labelItems)
      attributeSets.push(attributeLabelGroup)
    }

    this.setState({traversables: mappingAttributes})

    const attributeAssignment = createElement('div',
      {className: 'attribute-assignment'}, ...attributeSets)
    const viewContainer = createElement('div', {className: 'view-container'},
      attributeAssignment)
    const htmlElement = createElement('div', {className: 'view-element'},
      viewContainer)
    return this._getStereoscopicViews(htmlElement)
  }

  _buildMappingAttributes (mapping, maps, labels) {
    const mappingAttributes = [];
    for (let i = 0; i < maps.length; i++) {
      const attributes = []
      Object.keys(labels).map((key) => {
        const attribute = {
          id: key,
          key: `${maps[i].key}-${i}-${key}`,
          label: labels[key],
          visible: mapping[maps[i].key] === Number(key)
        }
        attributes.push(attribute)
      })
      mappingAttributes.push(attributes)
    }
    this.setState({mappingAttributes})
    return this.state.mappingAttributes;
  }

  _updateFocus (x, y) {
    const {traversables, focus} = this.state
    if (traversables[x] && traversables[x][y]) {
      if (traversables[focus.x][focus.y]) {
        traversables[focus.x][focus.y].focused = false
        focus.x = focus.y = null
      }
      traversables[x][y].focused = true
      console.log('> focused', traversables[x][y])
      focus.x = x
      focus.y = y
      this.setState({focus})
      this._updateView()
    }
  }

  _findFocus () {
    const {traversables, focus} = this.state
    for (let i = 0; i < traversables.length; i++) {
      for (let j = 0; j < traversables[i].length; j++) {
        if (traversables[i][j].focused) {
          focus.x = i
          focus.y = j
          this.setState({focus})
          return
        }
      }
    }
  }

  _handleAction (object) {
    const {switchDataset, toggleMenu} = this.props
    switch (object.action) {
      case 'switch-dataset':
        switchDataset(object)
        toggleMenu()
        break
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
      this._findFocus()
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
        if (object) {
          this._handleAction(object)
        }
      },
      next: () => {
        this._nextView()
      },
      prev: () => {
        this._previousView()
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