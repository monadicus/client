//
//  KBSourceView.h
//  Keybase
//
//  Created by Gabriel on 2/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"

typedef NS_ENUM (NSInteger, KBSourceViewItem) {
  KBSourceViewItemProfile = 1,
  KBSourceViewItemUsers,
  KBSourceViewItemDevices,
  KBSourceViewItemFolders
};

@class KBSourceView;

@protocol KBSourceViewDelegate
- (void)sourceView:(KBSourceView *)sourceView didSelectItem:(KBSourceViewItem)item;
@end

@interface KBSourceView : YONSView <NSOutlineViewDataSource, NSOutlineViewDelegate>

@property (weak) id<KBSourceViewDelegate> delegate;

@end
