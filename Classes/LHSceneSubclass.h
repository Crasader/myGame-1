#ifndef __LH_SCENE_SUBCLASS_H__
#define __LH_SCENE_SUBCLASS_H__

#include "cocos2d.h"
#include "LevelHelper2API.h"

class LHSceneSubclass : public LHScene
{
public:
    static cocos2d::Scene* createScene();

    LHSceneSubclass();
    virtual ~LHSceneSubclass();
    
    bool initWithContentOfFile(const std::string& plistLevelFile);
    
    Size size;
    
    //touch events
    
    bool onTouchBegan(Touch* touch, Event* event);
    void onTouchMoved(Touch* touch, Event* event);
    void onTouchEnded(Touch* touch, Event* event);
    
    void update(float dt);
    virtual void onEnterTransitionDidFinish();

 

    
private:
    
    LHSprite *sp;
    
    //Control Buttons
    
    LHSprite *leftButton, *rightButton, *jumpButton;
    
    bool moveLeft, moveRight, jump;
    
    void initButtons();
    
};

#endif // __LH_SCENE_SUBCLASS_H__
