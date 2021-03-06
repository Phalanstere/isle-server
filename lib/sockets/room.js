'use strict';

// MODULES //

var debug = require( 'debug' )( 'socket' );
var contains = require( '@stdlib/assert/contains' );
var Chat = require( './chat.js' );


// MAIN //

class Room {

	constructor( io, member, roomName ) {
		this.members = [ member ];
		this.owners = [];
		if ( member.owner ) {
			this.owners.push( member );
			member.socket.join( this.name+':owners' );
		}
		this.name = roomName;
		this.history = [];
		this.chats = {};

		member.socket.join( this.name );
		member.socket.emit( 'console', 'You, '+member.name+', have successfully created room '+this.name );
		this.sendUserList( member );
	}

	joinChat( name, member ) {
		const chatName = this.name + ':' + name;
		if ( !this.chats.hasOwnProperty( chatName ) ) {
			let chat = new Chat({ name: chatName, nMessages: 50 });
			this.chats[ chatName ] = chat;
		}
		this.chats[ chatName ].join( member );
	}

	leaveChat( name, member ) {
		const chatName = this.name + ':' + name;
		this.chats[ chatName ].leave( member );
	}

	join( member ) {
		if ( !contains( this.members.map( m => m.email ), member.email ) ) {
			this.members.push( member );
			if ( member.owner ) {
				this.owners.push( member );
				member.socket.join( this.name+':owners' );
			}
			member.socket.join( this.name );
			member.socket.emit( 'console', 'You, '+member.name+', have successfully joined room '+this.name );
			member.socket.to( this.name ).emit( 'console', member.name+' has successfully joined room '+this.name );
			member.socket.to( this.name ).emit( 'user_joins', JSON.stringify( member ) );
			member.socket.emit( 'user_joins', JSON.stringify( member ) );
		} else {
			debug( 'User who is already a member tried to join: ' + JSON.stringify( member ) );
		}
		this.sendUserList( member );
	}

	leave( member ) {
		if ( !member ) {
			return debug( 'Member is not valid anymore...' );
		}
		debug( 'A user is leaving the room: ' + JSON.stringify( member ) );
		if ( contains( this.members.map( m => m.email ), member.email ) ) {
			debug( 'Remove user from room members...' );
			this.members = this.members.filter( m => m !== member );
			member.setExitTime();
			member.socket.to( this.name ).emit( 'user_leaves', JSON.stringify( member ) );
			member.socket.emit( 'user_leaves', JSON.stringify( member ) );
			member.socket.leave( this.name );
			if ( member.owner ) {
				this.owners = this.owners.filter( o => o !== member );
				member.socket.leave( this.name+':owners' );
			}
		}
	}

	emitToOwners( data, member ) {
		if ( data.anonymous ) {
			data.email = 'anonymous';
			data.name = 'anonymous';
		} else {
			data.email = member.email;
			data.name = member.name;
		}
		debug( 'Should emit the following message to all room owners: ' + JSON.stringify( data ) );
		member.socket.to( this.name+':owners' ).emit( 'memberAction', data );

		// Send member action to incoming socket (useful for lesson development within the ISLE editor):
		member.socket.emit( 'memberAction', data );
	}

	emitToMembers( data, member ) {
		if ( data.anonymous ) {
			data.email = 'anonymous';
			data.name = 'anonymous';
		} else {
			data.email = member.email;
			data.name = member.name;
		}
		debug( 'Should emit the following message to all room members in '+this.name+': ' + JSON.stringify( data ) );
		member.socket.to( this.name ).emit( 'memberAction', data );
		member.socket.emit( 'memberAction', data );
	}

	sendUserList( member ) {
		debug( 'Send member list to incoming socket.' );
		member.socket.emit( 'userlist', JSON.stringify( this.members ) );
	}

}


// EXPORTS //

module.exports = Room;
