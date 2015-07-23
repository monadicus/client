//
//  KBRRequestParams.m
//  Keybase
//
//  Created by Gabriel on 2/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBRRequestParams.h"
#import "KBFormatter.h"

@interface KBRRequestParams ()
@property NSArray *params;
@end

@implementation KBRRequestParams

- (instancetype)init {
  [NSException raise:NSInvalidArgumentException format:@"Use initWithParams:"];
  return nil;
}

- (instancetype)initWithParams:(NSArray *)params {
  if ((self = [super init])) {
    _params = params;
  }
  return self;
}

- (NSString *)description {
  return KBDescription(self);
}

@end
