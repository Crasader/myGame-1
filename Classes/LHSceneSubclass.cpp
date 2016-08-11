#include "LHSceneSubclass.h"

USING_NS_CC;


Scene* LHSceneSubclass::createScene()
{
    CCLOG("LH SCENE SUBCLASS CREATE SCENE");
    
    CCLOG("DID CREATE SCENE\n");
    
    LHSceneSubclass *ret = new LHSceneSubclass();
    if (ret && ret->initWithContentOfFile("scenes/Untitled.lhplist"))
    {
        CCLOG("DID INIT OK\n");
        
        
        ret->autorelease();
        return ret;
    }
    else
    {
        CCLOG("SOMETHING WENT WRONG\n");
        
        CC_SAFE_DELETE(ret);
        return nullptr;
    }
}

LHSceneSubclass::LHSceneSubclass()
{
    /*INITIALIZE YOUR CONTENT HERE*/
    /*AT THIS POINT NOTHING IS LOADED*/
}

LHSceneSubclass::~LHSceneSubclass()
{
    //nothing to release
}

bool LHSceneSubclass::initWithContentOfFile(const std::string& plistLevelFile)
{
    bool retValue = LHScene::initWithContentOfFile(plistLevelFile);
    
    /*INITIALIZE YOUR CONTENT HERE*/
    /*AT THIS POINT EVERYTHING IS LOADED AND YOU CAN ACCESS YOUR OBJECTS*/
    
    
    size = this->getContentSize();
    
    sp = (LHSprite *)this->getGameWorldNode()->getChildByName("hero");
    
    //sp->getBox2dBody()->SetLinearVelocity(b2Vec2(5.0f, 0.0f));
    
    this->initButtons();
    
    
    return retValue;
}

void LHSceneSubclass::onEnterTransitionDidFinish(){
    
     this->schedule(schedule_selector(LHSceneSubclass::update));
    
}

void LHSceneSubclass::initButtons(){
    
    //left button
    
    leftButton = LHSprite::createWithSpriteName("button", "spritesheets.png", "scenes/", this->getUINode());
    
    leftButton->setPosition(Vec2(size.width*.1, size.height*.1));
    
    leftButton->setScale(2.75, 2.75);
    
    leftButton->setOpacity(128);
    
    
    //right Button
    
    rightButton = LHSprite::createWithSpriteName("button", "spritesheets.png", "scenes/", this->getUINode());
    
    rightButton->setPosition(Vec2(size.width*.3, size.height*.1));
    
    rightButton->setScale(2.75, 2.75);
    
    rightButton->setOpacity(128);
    
    
    //jump button
    
    jumpButton = LHSprite::createWithSpriteName("jumpButton", "spritesheets.png", "scenes/", this->getUINode());
    
    jumpButton->setPosition(Vec2(Vec2(size.width*.8, size.height*.1)));
    
    jumpButton->setScale(2.5, 2.5);
    
    jumpButton->setOpacity(128);
    
}

bool LHSceneSubclass::onTouchBegan(Touch *touch, Event *event){
    
    if(leftButton->getBoundingBox().containsPoint(touch->getLocation())){
        
        moveLeft = true;
        moveRight = false;
        
    }
    if(rightButton->getBoundingBox().containsPoint(touch->getLocation())){
        
        moveRight = true;
        moveLeft = false;
    }
    if(jumpButton->getBoundingBox().containsPoint(touch->getLocation())){
        
        jump = true;
        
    }
    
    return true;
    
}

void LHSceneSubclass::onTouchMoved(Touch *touch, Event *event){
    
    if(!leftButton->getBoundingBox().containsPoint(touch->getLocation())){
        
        moveLeft = false;
        
    }
    if(!rightButton->getBoundingBox().containsPoint(touch->getLocation())){
        
        moveRight = false;
        
    }
 
    
    
}

void LHSceneSubclass::onTouchEnded(Touch *touch, Event *event){
    
    if(leftButton->getBoundingBox().containsPoint(touch->getLocation())){
        
        moveLeft = false;
        
    }
    if(rightButton->getBoundingBox().containsPoint(touch->getLocation())){
        
        moveRight = false;
    }
    
    
    CCLOG("ended");
    
}

void LHSceneSubclass::update(float dt){
    
    if(moveLeft){
        
        sp->getBox2dBody()->ApplyForce(b2Vec2(-5.0f, 0.0f), b2Vec2(0.0f, 0.0f), true);
        
    }
    if(moveRight){
        
        sp->getBox2dBody()->ApplyForce(b2Vec2(5.0f, 0.0f), b2Vec2(0.0f, 0.0f), true);
        
    }
    
    if(abs(sp->getBox2dBody()->GetLinearVelocity().x > 6.0f)){
        
        sp->getBox2dBody()->SetLinearVelocity(b2Vec2(6.0f, sp->getBox2dBody()->GetLinearVelocity().y));
        
    }
    
    if(jump){
        
        jump = false;
        
        sp->getBox2dBody()->SetLinearVelocity(b2Vec2(sp->getBox2dBody()->GetLinearVelocity().x, 4.0f));
        
    }
    
}
