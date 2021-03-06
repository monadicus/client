// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Flow from '../../util/flow'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import * as RowTypes from './types'
import Placeholder from './placeholder'
import TlfType from './tlf-type-container'
import Tlf from './tlf-container'
import Still from './still-container'
import Editing from './editing-container'
import Uploading from './uploading-container'
import LoadFilesWhenNeeded from './load-files-when-needed'
import {normalRowHeight} from './common'
import {memoize} from '../../util/memoize'

type Props = {
  destinationPickerIndex?: number,
  items: Array<RowTypes.RowItemWithKey>,
  isEmpty: boolean,
  path: Types.Path,
  routePath: I.List<string>,
}

export const WrapRow = ({children}: {children: React.Node}) => (
  <Kb.Box style={styles.rowContainer}>
    {children}
    <Kb.Divider key="divider" style={styles.divider} />
  </Kb.Box>
)

export const EmptyRow = () => <Kb.Box style={styles.rowContainer} />

class Rows extends React.PureComponent<Props> {
  _rowRenderer = (index: number, item: RowTypes.RowItem) => {
    switch (item.rowType) {
      case 'placeholder':
        return (
          <WrapRow>
            <Placeholder type={item.type} />
          </WrapRow>
        )
      case 'tlf-type':
        return (
          <WrapRow>
            <TlfType
              name={item.name}
              destinationPickerIndex={this.props.destinationPickerIndex}
              routePath={this.props.routePath}
            />
          </WrapRow>
        )
      case 'tlf':
        return (
          <WrapRow>
            <Tlf
              name={item.name}
              tlfType={item.tlfType}
              destinationPickerIndex={this.props.destinationPickerIndex}
              routePath={this.props.routePath}
            />
          </WrapRow>
        )
      case 'still':
        return (
          <WrapRow>
            <Still
              name={item.name}
              path={item.path}
              destinationPickerIndex={this.props.destinationPickerIndex}
              routePath={this.props.routePath}
            />
          </WrapRow>
        )
      case 'uploading':
        return (
          <WrapRow>
            <Uploading name={item.name} path={item.path} />
          </WrapRow>
        )
      case 'editing':
        return (
          <WrapRow>
            <Editing editID={item.editID} routePath={this.props.routePath} />
          </WrapRow>
        )
      case 'empty':
        return <EmptyRow />
      case 'header':
        return item.node
      default:
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(item.rowType)
        return (
          <WrapRow>
            <Kb.Text type="BodySmallError">This should not happen. {item.rowType}</Kb.Text>
          </WrapRow>
        )
    }
  }
  _getVariableRowLayout = (items, index) => ({
    height: getRowHeight(items[index]),
    offset: items.slice(0, index).reduce((offset, row) => offset + getRowHeight(row), 0),
  })
  _getTopVariableRowCountAndTotalHeight = memoize(items => {
    const index = items.findIndex(row => row !== 'header')
    return index === -1
      ? {count: items.length, totalHeight: -1}
      : {count: index, totalHeight: this._getVariableRowLayout(items, index).offset}
  })
  _getItemLayout = index => {
    const top = this._getTopVariableRowCountAndTotalHeight(this.props.items)
    if (index < top.count) {
      return this._getVariableRowLayout(this.props.items, index)
    }
    return {
      height: getRowHeight(this.props.items[index]),
      offset: (index - top.count) * normalRowHeight + top.totalHeight,
    }
  }
  // List2 caches offsets. So have the key derive from layouts so that we
  // trigger a re-render when layout changes. Also encode items length into
  // this, otherwise we'd get taller-than content rows when going into a
  // smaller folder from a larger one.
  _getListKey = memoize(items => {
    const index = items.findIndex(row => row.rowType !== 'header')
    return (
      items
        .slice(0, index === -1 ? items.length : index)
        .map(row => getRowHeight(row).toString())
        .join('-') + `:${items.length}`
    )
  })

  render() {
    const content = this.props.isEmpty ? (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
        {// The folder is empty so these should all be header rows.
        this.props.items.map(item => item.rowType === 'header' && item.node)}
        <Kb.Box2 direction="vertical" style={styles.emptyContainer} centerChildren={true}>
          <Kb.Text type="BodySmall">This folder is empty.</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    ) : (
      <Kb.BoxGrow>
        <Kb.List2
          key={this._getListKey(this.props.items)}
          items={this.props.items}
          bounces={true}
          itemHeight={{
            getItemLayout: this._getItemLayout,
            type: 'variable',
          }}
          renderItem={this._rowRenderer}
        />
      </Kb.BoxGrow>
    )
    return (
      <>
        <LoadFilesWhenNeeded
          path={this.props.path}
          destinationPickerIndex={this.props.destinationPickerIndex}
        />
        {content}
      </>
    )
  }
}

const styles = Styles.styleSheetCreate({
  divider: {
    backgroundColor: Styles.globalColors.black_05,
    marginLeft: 64,
  },
  emptyContainer: {
    ...Styles.globalStyles.flexGrow,
  },
  rowContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    flexShrink: 0,
    height: normalRowHeight,
  },
})

const getRowHeight = (row: RowTypes.RowItemWithKey) =>
  row.rowType === 'header' ? row.height : normalRowHeight

export default Rows
