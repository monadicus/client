// @flow
import * as ProfileGen from '../profile-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {peopleTab} from '../../constants/tabs'
import flags from '../../util/feature-flags'

const navBack = flags.useNewRouter
  ? null
  : Saga.put(RouteTreeGen.createNavigateTo({path: [peopleTab, 'profile']}))

function* generatePgp(state) {
  let canceled = false

  const ids = [state.profile.pgpEmail1, state.profile.pgpEmail2, state.profile.pgpEmail3]
    .filter(Boolean)
    .map(email => ({
      comment: '',
      email: email || '',
      username: state.profile.pgpFullName || '',
    }))

  const onKeyGenerated = ({key}, response) => {
    if (canceled) {
      response.error({code: RPCTypes.constantsStatusCode.scinputcanceled, desc: 'Input canceled'})
      return navBack
    } else {
      response.result()
      return Saga.put(ProfileGen.createUpdatePgpPublicKey({publicKey: key.key}))
    }
  }

  const onShouldPushPrivate = (_, response) => {
    return Saga.callUntyped(function*() {
      yield Saga.put(
        RouteTreeGen.createNavigateTo({
          path: [
            peopleTab,
            'profile',
            'profilePgp',
            'profileProvideInfo',
            'profileGenerate',
            'profileFinished',
          ],
        })
      )
      const action: ProfileGen.FinishedWithKeyGenPayload = yield Saga.take(ProfileGen.finishedWithKeyGen)
      response.result(action.payload.shouldStoreKeyOnServer)
      yield navBack
    })
  }
  const onFinished = () => {}

  yield Saga.put(
    RouteTreeGen.createNavigateTo({
      path: [peopleTab, 'profile', 'profilePgp', 'profileProvideInfo', 'profileGenerate'],
    })
  )
  // We allow the UI to cancel this call. Just stash this intention and nav away and response with an error to the rpc
  const cancelTask = yield Saga._fork(function*() {
    yield Saga.take(ProfileGen.cancelPgpGen)
    yield navBack
    canceled = true
  })
  try {
    yield RPCTypes.pgpPgpKeyGenDefaultRpcSaga({
      customResponseIncomingCallMap: {
        'keybase.1.pgpUi.keyGenerated': onKeyGenerated,
        'keybase.1.pgpUi.shouldPushPrivate': onShouldPushPrivate,
      },
      incomingCallMap: {'keybase.1.pgpUi.finished': onFinished},
      params: {createUids: {ids, useDefault: false}},
    })
  } catch (e) {
    // did we cancel?
    if (e.code !== RPCTypes.constantsStatusCode.scinputcanceled) {
      throw e
    }
  }
  cancelTask.cancel()
}

function* pgpSaga(): Generator<any, void, any> {
  yield* Saga.chainGenerator<ProfileGen.GeneratePgpPayload>(ProfileGen.generatePgp, generatePgp)
}

export {pgpSaga}
