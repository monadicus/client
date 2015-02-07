//
//  KBUserView.h
//  Keybase
//
//  Created by Gabriel on 1/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import <YOLayout/YOLayout.h>
#import "KBRPC.h"

@interface KBUserView : YONSView

- (void)setUser:(KBRUser *)user;

@end
