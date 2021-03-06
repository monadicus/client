// @flow
import {namedConnect} from '../../util/container'
import * as I from 'immutable'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import DefaultView from './default-view'

type OwnProps = {|
  path: Types.Path,
  routePath: I.List<string>,
  onLoadingStateChange?: () => void,
|}

const mapStateToProps = (state, {path}: OwnProps) => ({
  pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  sfmiEnabled: state.fs.sfmi.driverStatus === 'enabled',
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  download: () => dispatch(FsGen.createDownload({key: Constants.makeDownloadKey(path), path})),
  showInSystemFileManager: () => dispatch(FsGen.createOpenPathInSystemFileManager({path})),
})

const mergeProps = (stateProps, dispatchProps, {path, routePath}) => {
  const {sfmiEnabled, pathItem} = stateProps
  const {download, showInSystemFileManager} = dispatchProps
  return {
    download,
    path,
    pathItem,
    routePath,
    sfmiEnabled,
    showInSystemFileManager,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'FilePreviewDefaultView'
)(DefaultView)
