package flip

import (
	"context"
	"fmt"
	"math/big"
	"testing"
	"time"

	chat1 "github.com/keybase/client/go/protocol/chat1"
	clockwork "github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

type chatServer struct {
	shutdownCh       chan struct{}
	inputCh          chan GameMessageWrappedEncoded
	chatClients      []*chatClient
	clock            clockwork.FakeClock
	clockForArchiver clockwork.FakeClock
	corruptor        func(GameMessageWrappedEncoded) GameMessageWrappedEncoded
	gameHistories    map[GameIDKey]GameHistory
}

type chatClient struct {
	shutdownCh chan struct{}
	me         UserDevice
	ch         chan GameMessageWrappedEncoded
	server     *chatServer
	dealer     *Dealer
	history    map[string]bool
	clock      clockwork.FakeClock
}

var _ DealersHelper = (*chatClient)(nil)
var _ ReplayHelper = (*chatClient)(nil)

func (c *chatClient) Clock() clockwork.Clock {
	if c.clock != nil {
		return c.clock
	}
	return c.server.clock
}

func (c *chatClient) ServerTime(context.Context) (time.Time, error) {
	return c.Clock().Now(), nil
}

func (c *chatClient) CLogf(ctx context.Context, fmtString string, args ...interface{}) {
	fmt.Printf(fmtString+"\n", args...)
}

func (c *chatClient) Me() UserDevice {
	return c.me
}

func (c *chatClient) SendChat(ctx context.Context, conversationID chat1.ConversationID,
	gameID chat1.FlipGameID, msg GameMessageEncoded) error {
	c.server.inputCh <- GameMessageWrappedEncoded{Body: msg, GameID: gameID, Sender: c.me}
	return nil
}

func (s *chatServer) archive(msg GameMessageWrappedEncoded) {
	v := s.gameHistories[GameIDToKey(msg.GameID)]
	cl := s.clock
	if s.clockForArchiver != nil {
		cl = s.clockForArchiver
	}
	v = append(v, GameMessageReplayed{GameMessageWrappedEncoded: msg, Time: cl.Now()})
	s.gameHistories[GameIDToKey(msg.GameID)] = v
}

func (s *chatServer) run(ctx context.Context) {
	for {
		select {
		case <-s.shutdownCh:
			return
		case msg := <-s.inputCh:
			if s.corruptor != nil {
				msg = s.corruptor(msg)
			}
			s.archive(msg)
			for _, cli := range s.chatClients {
				if !cli.me.Eq(msg.Sender) {
					cli.ch <- msg
				}
			}
		}
	}
}

func (s *chatServer) stop() {
	close(s.shutdownCh)
}

func newChatServer() *chatServer {
	return &chatServer{
		clock:         clockwork.NewFakeClock(),
		shutdownCh:    make(chan struct{}),
		inputCh:       make(chan GameMessageWrappedEncoded, 1000),
		gameHistories: make(map[GameIDKey]GameHistory),
	}
}

func (s *chatServer) newClient() *chatClient {
	ret := &chatClient{
		shutdownCh: make(chan struct{}),
		me:         newTestUser(),
		ch:         make(chan GameMessageWrappedEncoded, 1000),
		server:     s,
		history:    make(map[string]bool),
	}
	ret.dealer = NewDealer(ret)
	s.chatClients = append(s.chatClients, ret)
	return ret
}

func (c *chatClient) run(ctx context.Context, ch chat1.ConversationID) {
	go c.dealer.Run(ctx)
	for {
		select {
		case <-c.shutdownCh:
			return
		case msg := <-c.ch:
			chKey := ch.String()
			c.dealer.InjectIncomingChat(ctx, msg.Sender, ch, msg.GameID, msg.Body, !c.history[chKey])
			c.history[chKey] = true
		}
	}
}

func (s *chatServer) makeAndRunClients(ctx context.Context, ch chat1.ConversationID, nClients int) []*chatClient {
	for i := 0; i < nClients; i++ {
		cli := s.newClient()
		go cli.run(ctx, ch)
	}
	return s.chatClients
}

func forAllClients(clients []*chatClient, f func(c *chatClient)) {
	for _, cli := range clients {
		f(cli)
	}
}

func nTimes(n int, f func()) {
	for i := 0; i < n; i++ {
		f()
	}
}

func (c *chatClient) consumeCommitment(t *testing.T) {
	msg := <-c.dealer.UpdateCh()
	require.NotNil(t, msg.Commitment)
}

func (c *chatClient) consumeCommitmentComplete(t *testing.T, n int) {
	msg := <-c.dealer.UpdateCh()
	require.NotNil(t, msg.CommitmentComplete)
	require.Equal(t, n, len(msg.CommitmentComplete.Players))
}

func (c *chatClient) consumeReveal(t *testing.T) {
	msg := <-c.dealer.UpdateCh()
	require.NotNil(t, msg.Reveal)
}

func (c *chatClient) consumeAbsteneesError(t *testing.T, n int) {
	msg := <-c.dealer.UpdateCh()
	require.Error(t, msg.Err)
	ae, ok := msg.Err.(AbsenteesError)
	require.True(t, ok)
	require.Equal(t, n, len(ae.Absentees))
}

func (c *chatClient) consumeResult(t *testing.T, r **big.Int) {
	msg := <-c.dealer.UpdateCh()
	require.NotNil(t, msg.Result)
	require.NotNil(t, msg.Result.Big)
	if *r == nil {
		*r = msg.Result.Big
	}
	require.Equal(t, 0, msg.Result.Big.Cmp(*r))
}

func (c *chatClient) consumeError(t *testing.T, e error) {
	msg := <-c.dealer.UpdateCh()
	require.NotNil(t, msg.Err)
	require.IsType(t, e, msg.Err)
}

func (c *chatClient) consumeRevealsAndError(t *testing.T, nReveals int) {
	revealsReceived := 0
	errorsReceived := 0
	for errorsReceived == 0 {
		fmt.Printf("[%s] waiting for msg....\n", c.me)
		msg := <-c.dealer.UpdateCh()
		fmt.Printf("[%s] msg gotten: %+v\n", c.me, msg)
		switch {
		case msg.Reveal != nil:
			revealsReceived++
		case msg.Err != nil:
			errorsReceived++
			require.IsType(t, BadRevealError{}, msg.Err)
		default:
			require.Fail(t, "unexpected msg type received: %+v", msg)
		}
	}
	require.True(t, revealsReceived <= nReveals)
}

func (c *chatClient) consumeTimeoutError(t *testing.T) {
	msg := <-c.dealer.UpdateCh()
	fmt.Printf("ERR %+v\n", msg)
}

func (c *chatClient) stop() {
	close(c.shutdownCh)
}

func (s *chatServer) stopClients() {
	for _, cli := range s.chatClients {
		cli.stop()
	}
}

func TestHappyChat10(t *testing.T) {
	testHappyChat(t, 10)
}

func TestHappyChat100(t *testing.T) {
	testHappyChat(t, 100)
}

func testHappyChat(t *testing.T, n int) {
	srv := newChatServer()
	ctx := context.Background()
	go srv.run(ctx)
	defer srv.stop()
	conversationID := genConversationID()
	gameID := GenerateGameID()
	clients := srv.makeAndRunClients(ctx, conversationID, n)
	defer srv.stopClients()

	start := NewStartWithBigInt(srv.clock.Now(), pi())
	err := clients[0].dealer.StartFlipWithGameID(ctx, start, conversationID, gameID)
	require.NoError(t, err)
	forAllClients(clients, func(c *chatClient) { nTimes(n, func() { c.consumeCommitment(t) }) })
	srv.clock.Advance(time.Duration(4001) * time.Millisecond)
	forAllClients(clients, func(c *chatClient) { c.consumeCommitmentComplete(t, n) })
	forAllClients(clients, func(c *chatClient) { nTimes(n, func() { c.consumeReveal(t) }) })
	var b *big.Int
	forAllClients(clients, func(c *chatClient) { c.consumeResult(t, &b) })

	res, err := Replay(ctx, clients[0], srv.gameHistories[GameIDToKey(gameID)])
	require.NoError(t, err)
	require.Equal(t, 0, b.Cmp(res.Result.Big))
}

func TestSadChatOneAbsentee(t *testing.T) {
	testAbsentees(t, 10, 1)
}

func TestSadChatFiveAbsentees(t *testing.T) {
	testAbsentees(t, 20, 5)
}

func TestSadChatOneCorruption(t *testing.T) {
	testCorruptions(t, 10, 1)
}

func TestSadChatFiveCorruptions(t *testing.T) {
	testCorruptions(t, 30, 5)
}

func TestBadLeaderTenFollowers(t *testing.T) {
	testBadLeader(t, 10)
}

func testAbsentees(t *testing.T, nTotal int, nAbsentees int) {
	srv := newChatServer()
	ctx := context.Background()
	go srv.run(ctx)
	defer srv.stop()
	conversationID := genConversationID()
	clients := srv.makeAndRunClients(ctx, conversationID, nTotal)
	defer srv.stopClients()

	gameID := GenerateGameID()
	start := NewStartWithBigInt(srv.clock.Now(), pi())
	err := clients[0].dealer.StartFlipWithGameID(ctx, start, conversationID, gameID)
	require.NoError(t, err)
	present := nTotal - nAbsentees
	forAllClients(clients, func(c *chatClient) { nTimes(nTotal, func() { c.consumeCommitment(t) }) })
	forAllClients(clients[present:], func(c *chatClient) { c.dealer.Stop() })
	clients = clients[0:present]
	srv.clock.Advance(time.Duration(4001) * time.Millisecond)
	forAllClients(clients, func(c *chatClient) { c.consumeCommitmentComplete(t, nTotal) })
	forAllClients(clients, func(c *chatClient) { nTimes(present, func() { c.consumeReveal(t) }) })
	srv.clock.Advance(time.Duration(31001) * time.Millisecond)
	forAllClients(clients, func(c *chatClient) { c.consumeAbsteneesError(t, nAbsentees) })

	_, err = Replay(ctx, clients[0], srv.gameHistories[GameIDToKey(gameID)])
	require.Error(t, err)
	require.IsType(t, AbsenteesError{}, err)
	ae, ok := err.(AbsenteesError)
	require.True(t, ok)
	require.Equal(t, nAbsentees, len(ae.Absentees))
}

func corruptBytes(b []byte) {
	b[0] ^= 0x1
}

func testCorruptions(t *testing.T, nTotal int, nCorruptions int) {
	srv := newChatServer()
	ctx := context.Background()
	go srv.run(ctx)
	defer srv.stop()
	conversationID := genConversationID()
	clients := srv.makeAndRunClients(ctx, conversationID, nTotal)
	defer srv.stopClients()

	good := nTotal - nCorruptions
	isBad := func(u UserDevice) bool {
		for i := good; i < nTotal; i++ {
			if clients[i].me.Eq(u) {
				return true
			}
		}
		return false
	}

	srv.corruptor = func(m GameMessageWrappedEncoded) GameMessageWrappedEncoded {
		w, err := m.Decode()
		require.NoError(t, err)
		body := w.Msg.Body
		typ, err := body.T()
		require.NoError(t, err)
		if typ != MessageType_REVEAL {
			return m
		}
		if !isBad(m.Sender) {
			return m
		}
		reveal := body.Reveal()
		corruptBytes(reveal.Secret[:])
		w.Msg.Body = NewGameMessageBodyWithReveal(reveal)
		enc, err := w.Encode()
		require.NoError(t, err)
		m.Body = enc
		return m
	}

	start := NewStartWithBigInt(srv.clock.Now(), pi())
	gameID := GenerateGameID()
	err := clients[0].dealer.StartFlipWithGameID(ctx, start, conversationID, gameID)
	require.NoError(t, err)
	forAllClients(clients, func(c *chatClient) { nTimes(nTotal, func() { c.consumeCommitment(t) }) })
	srv.clock.Advance(time.Duration(4001) * time.Millisecond)
	forAllClients(clients, func(c *chatClient) { c.consumeCommitmentComplete(t, nTotal) })
	forAllClients(clients[0:good], func(c *chatClient) { c.consumeRevealsAndError(t, good) })

	_, err = Replay(ctx, clients[0], srv.gameHistories[GameIDToKey(gameID)])
	require.Error(t, err)
	require.IsType(t, BadRevealError{}, err)
}

func testBadLeader(t *testing.T, nTotal int) {
	srv := newChatServer()
	ctx := context.Background()
	go srv.run(ctx)
	defer srv.stop()
	conversationID := genConversationID()
	clients := srv.makeAndRunClients(ctx, conversationID, nTotal)
	defer srv.stopClients()

	start := NewStartWithBigInt(srv.clock.Now(), pi())
	err := clients[0].dealer.StartFlip(ctx, start, conversationID)
	require.NoError(t, err)
	forAllClients(clients, func(c *chatClient) { nTimes(nTotal, func() { c.consumeCommitment(t) }) })
	clients[0].dealer.Stop()
	srv.clock.Advance(time.Duration(8001) * time.Millisecond)
	forAllClients(clients[1:], func(c *chatClient) { c.consumeTimeoutError(t) })
}

func TestRepeatedGame(t *testing.T) {

	srv := newChatServer()
	ctx := context.Background()
	go srv.run(ctx)
	defer srv.stop()
	conversationID := genConversationID()
	clients := srv.makeAndRunClients(ctx, conversationID, 5)
	defer srv.stopClients()

	gameID := GenerateGameID()
	forAllClients(clients[1:], func(c *chatClient) { c.history[conversationID.String()] = true })
	start := NewStartWithBigInt(srv.clock.Now(), pi())
	_, err := clients[0].dealer.startFlipWithGameID(ctx, start, conversationID, gameID)
	require.NoError(t, err)
	clients[0].consumeCommitment(t)
	forAllClients(clients[1:], func(c *chatClient) { c.consumeError(t, GameReplayError{}) })
}

func genConversationID() chat1.ConversationID {
	return chat1.ConversationID(randBytes(12))
}

func testLeaderClockSkew(t *testing.T, skew time.Duration) {

	srv := newChatServer()
	ctx := context.Background()
	go srv.run(ctx)
	defer srv.stop()
	conversationID := genConversationID()
	n := 6
	clients := srv.makeAndRunClients(ctx, conversationID, n)
	defer srv.stopClients()

	srv.clock = clockwork.NewFakeClockAt(time.Now())
	now := srv.clock.Now()
	start := NewStartWithBigInt(now, pi())
	correctClock := clockwork.NewFakeClockAt(now.Add(skew))
	srv.clockForArchiver = correctClock
	forAllClients(clients[1:], func(c *chatClient) { c.clock = correctClock })
	gameID := GenerateGameID()
	err := clients[0].dealer.StartFlipWithGameID(ctx, start, conversationID, gameID)
	require.NoError(t, err)
	forAllClients(clients[1:], func(c *chatClient) { c.consumeError(t, BadLeaderClockError{}) })

	_, err = Replay(ctx, clients[0], srv.gameHistories[GameIDToKey(gameID)])
	require.Error(t, err)
	require.IsType(t, BadLeaderClockError{}, err)
}

func TestLeaderClockSkewFast(t *testing.T) {
	testLeaderClockSkew(t, 2*time.Hour)
}

func TestLeaderClockSkewSlow(t *testing.T) {
	testLeaderClockSkew(t, -2*time.Hour)
}