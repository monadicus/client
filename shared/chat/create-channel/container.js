// @flow
import * as TeamsGen from '../../actions/teams-gen'
import CreateChannel from '.'
import {
  compose,
  withHandlers,
  lifecycle,
  withStateHandlers,
  connect,
  type RouteProps,
} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {upperFirst} from 'lodash-es'
import flags from '../../util/feature-flags'

type OwnProps = RouteProps<{teamname: string}, {}>

const mapStateToProps = (state, {routeProps}) => {
  return {
    errorText: upperFirst(state.teams.channelCreationError),
    teamname: routeProps.get('teamname'),
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routePath}) => ({
  _onCreateChannel: ({channelname, description, teamname}) => {
    const rootPath = routePath.take(1)
    const sourceSubPath = routePath.rest()
    const destSubPath = sourceSubPath.butLast()
    dispatch(
      TeamsGen.createCreateChannel({channelname, description, destSubPath, rootPath, sourceSubPath, teamname})
    )
  },
  _onSetChannelCreationError: error => {
    dispatch(TeamsGen.createSetChannelCreationError({error}))
  },
  onBack: () =>
    dispatch(
      flags.useNewRouter
        ? navigateUp()
        : RouteTreeGen.createNavigateTo({parentPath: routePath.butLast(), path: ['chatManageChannels']})
    ),
  onClose: () => dispatch(navigateUp()),
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  withStateHandlers(
    {
      channelname: null,
      description: null,
    },
    {
      onChannelnameChange: () => channelname => ({channelname}),
      onDescriptionChange: () => description => ({description}),
    }
  ),
  withHandlers({
    onSubmit: ({channelname, description, _onCreateChannel, teamname}) => () => {
      channelname && _onCreateChannel({channelname, description, teamname})
    },
  }),
  lifecycle({
    componentDidMount() {
      this.props._onSetChannelCreationError('')
    },
  })
)(CreateChannel)
